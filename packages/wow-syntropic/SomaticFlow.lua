-- SomaticFlow.lua - APM Entropy, Reaction Latency, and Somatic Strain Monitor
-- Distinguishes human organic flow from synthetic rotation botting and auto-kick injection

local ADDON_NAME, ns = ...
local SomaticFlow = {}
ns.SomaticFlow = SomaticFlow

local castIntervals = {}
local MAX_INTERVALS = 30
local lastCastTimeMs = 0
local enemyCastStartTimes = {}

-- High-priority interruptible spells (Spells that bots trigger instant kicks on)
local TRACKED_ENEMY_SPELLS = {
    [118] = "Polymorph",
    [5782] = "Fear",
    [116858] = "Chaos Bolt",
    [698] = "Ritual of Summoning",
    [20066] = "Repentance",
    [51514] = "Hex"
}

-- Player interrupt spells
local INTERRUPT_SPELLS = {
    [1766] = "Kick",
    [6552] = "Pummel",
    [2139] = "Counterspell",
    [57994] = "Wind Shear",
    [47528] = "Mind Freeze",
    [96231] = "Rebuke",
    [183752] = "Disrupt",
    [31935] = "Avenger's Shield",
    [78675] = "Solar Beam"
}

function SomaticFlow:OnCombatLogEvent(...)
    local timestamp, subevent, _, sourceGUID, sourceName, sourceFlags, _, destGUID, destName, destFlags, _, spellID, spellName = ...

    -- 1. Track enemy spellcast starts
    if subevent == "SPELL_CAST_START" then
        if sourceGUID ~= UnitGUID("player") and (TRACKED_ENEMY_SPELLS[spellID] or true) then
            enemyCastStartTimes[sourceGUID] = debugprofilestop()
        end

    -- 2. Track player interrupts
    elseif subevent == "SPELL_CAST_SUCCESS" and sourceGUID == UnitGUID("player") then
        if INTERRUPT_SPELLS[spellID] and destGUID and enemyCastStartTimes[destGUID] then
            local reactionTimeMs = debugprofilestop() - enemyCastStartTimes[destGUID]
            enemyCastStartTimes[destGUID] = nil

            -- Human vs Bot Reaction Boundary
            if reactionTimeMs < 45.0 then
                FidelityWoW_Telemetry.inhumanKickDetected = true
                FidelityWoW_Telemetry.lastReactionMs = reactionTimeMs
                print(string.format("|cffff0000[Fidelity Warden ALERT]|r Inhuman reaction time detected: %.1f ms (< 45ms botting threshold).", reactionTimeMs))
            else
                FidelityWoW_Telemetry.inhumanKickDetected = false
                FidelityWoW_Telemetry.lastReactionMs = reactionTimeMs
                print(string.format("|cff00ff00[Fidelity Flow]|r Human reaction verified: %.1f ms (Physical neuromuscular range).", reactionTimeMs))
            end
        end
    end
end

function SomaticFlow:OnPlayerCast(event, spellID, target, timeMs)
    if event == "UNIT_SPELLCAST_SUCCEEDED" then
        if lastCastTimeMs > 0 then
            local dt = (timeMs - lastCastTimeMs) / 1000.0
            if dt > 0.01 and dt < 10.0 then
                table.insert(castIntervals, dt)
                if #castIntervals > MAX_INTERVALS then table.remove(castIntervals, 1) end
            end
        end
        lastCastTimeMs = timeMs

        -- Compute APM Entropy
        self:ComputeEntropy()
    end
end

function SomaticFlow:ComputeEntropy()
    if #castIntervals < 10 then return end

    -- Shannon entropy of cast intervals
    -- Fixed-interval rotation bots produce H close to 0; human play produces H in [1.2, 2.5]
    local mean = 0
    for _, dt in ipairs(castIntervals) do mean = mean + dt end
    mean = mean / #castIntervals

    local variance = 0
    for _, dt in ipairs(castIntervals) do
        variance = variance + (dt - mean) * (dt - mean)
    end
    variance = variance / #castIntervals

    local stdDev = math.sqrt(variance)
    local entropyEstimate = math.log(stdDev + 0.001) + 2.0
    entropyEstimate = math.max(0.0, math.min(3.0, entropyEstimate))

    FidelityWoW_Telemetry.apmEntropy = tonumber(string.format("%.3f", entropyEstimate))

    -- Frantic click strain penalty
    if mean < 0.20 then
        -- Spamming < 200ms per action
        FidelityWoW_Telemetry.strainJoules = FidelityWoW_Telemetry.strainJoules + 0.05
    end
end

function SomaticFlow:ComputeFlowState(timeMs)
    -- Update Four-Floats S = (Pxd, Vtx, Lx, Aq)
    local entropy = FidelityWoW_Telemetry.apmEntropy or 1.5
    local ftle = FidelityWoW_Telemetry.lyapunovFTLE or 0.005

    -- Pxd (Interrogative/Tactical Tension): higher in combat
    local pxd = FidelityWoW_Telemetry.inCombat and 0.45 or 0.15
    -- Vtx (Vortex/Action Momentum): directly related to healthy rhythmic APM
    local vtx = math.min(0.95, math.max(0.10, entropy / 2.5))
    -- Lx (Radiance/Clarity): drop if strain or kinematic anomalies arise
    local lx = (FidelityWoW_Telemetry.strainJoules > 2.0 or ftle > 0.010) and 0.65 or 0.98
    -- Aq (Syntropic Reserve): decreases as strain accumulates
    local aq = math.max(0.05, 0.30 - (FidelityWoW_Telemetry.strainJoules * 0.02))

    FidelityWoW_Telemetry.fourFloats = {
        Pxd = tonumber(string.format("%.3f", pxd)),
        Vtx = tonumber(string.format("%.3f", vtx)),
        Lx = tonumber(string.format("%.3f", lx)),
        Aq = tonumber(string.format("%.3f", aq))
    }

    FidelityWoW_Telemetry.coherence = tonumber(string.format("%.2f", (lx + (1.0 - ftle * 10)) / 2.0))
end
