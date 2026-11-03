-- SomaticFlow.lua - APM Shannon Entropy, Reaction Latency, and Somatic Strain Monitor
-- Distinguishes human organic flow from synthetic rotation botting and auto-kick injection

local ADDON_NAME, ns = ...
local SomaticFlow = {}
ns.SomaticFlow = SomaticFlow

local castIntervals = {}
local MAX_INTERVALS = 30
local lastCastTimeMs = 0
local enemyCastStartTimes = {}

-- Unified thresholds
local ROBOTIC_INJECTION_THRESHOLD_MS = 60.0
local PREDICTIVE_THRESHOLD_MS = 130.0

-- Verified Player interrupt spells
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
    if not FidelityWoW_Config.enabled then return end

    local timestamp, subevent, _, sourceGUID, sourceName, sourceFlags, _, destGUID, destName, destFlags, _, spellID, spellName, _, extraSpellID, extraSpellName = ...

    -- 1. Track enemy spellcast starts
    if subevent == "SPELL_CAST_START" then
        if sourceGUID and sourceGUID ~= UnitGUID("player") then
            enemyCastStartTimes[sourceGUID] = {
                t = debugprofilestop and debugprofilestop() or (GetTime() * 1000),
                spellName = spellName,
                spellID = spellID
            }
        end

    -- 2. Track CONFIRMED interrupts: subevent == "SPELL_INTERRUPT"
    elseif subevent == "SPELL_INTERRUPT" and sourceGUID == UnitGUID("player") then
        local enemyCast = destGUID and enemyCastStartTimes[destGUID]
        if enemyCast then
            local nowMs = debugprofilestop and debugprofilestop() or (GetTime() * 1000)
            local reactionTimeMs = nowMs - enemyCast.t
            enemyCastStartTimes[destGUID] = nil

            local verdict = "human_reflex"
            if reactionTimeMs < ROBOTIC_INJECTION_THRESHOLD_MS then
                verdict = "robotic_injection"
                FidelityWoW_Telemetry.inhumanKickDetected = true
                print(string.format("|cffff0000[Fidelity Warden ALERT]|r Inhuman reaction time: %.1f ms (< %.0fms botting limit).", reactionTimeMs, ROBOTIC_INJECTION_THRESHOLD_MS))
            elseif reactionTimeMs < PREDICTIVE_THRESHOLD_MS then
                verdict = "predictive_timing"
                FidelityWoW_Telemetry.inhumanKickDetected = false
                print(string.format("|cffffcc00[Fidelity Warden]|r Fast predictive interrupt: %.1f ms.", reactionTimeMs))
            else
                verdict = "human_reflex"
                FidelityWoW_Telemetry.inhumanKickDetected = false
                print(string.format("|cff00ff00[Fidelity Flow]|r Verified human reflex: %.1f ms.", reactionTimeMs))
            end

            FidelityWoW_Telemetry.lastReactionMs = reactionTimeMs
            FidelityWoW_Telemetry.lastReactionVerdict = verdict

            if FidelityWoW_Config.optIn and FidelityWoW_Export then
                table.insert(FidelityWoW_Export.interrupts, {
                    reactionTimeMs = reactionTimeMs,
                    verdict = verdict,
                    spellName = spellName,
                    interruptedSpell = extraSpellName or enemyCast.spellName
                })
                if #FidelityWoW_Export.interrupts > 50 then table.remove(FidelityWoW_Export.interrupts, 1) end
            end
        end
    end
end

function SomaticFlow:OnPlayerCast(event, spellID, target, timeMs)
    if not FidelityWoW_Config.enabled then return end

    if event == "UNIT_SPELLCAST_SUCCEEDED" then
        if lastCastTimeMs > 0 then
            local dt = (timeMs - lastCastTimeMs) -- in ms
            if dt > 10 and dt < 10000 then
                table.insert(castIntervals, dt)
                if #castIntervals > MAX_INTERVALS then table.remove(castIntervals, 1) end

                if FidelityWoW_Config.optIn and FidelityWoW_Export then
                    table.insert(FidelityWoW_Export.castIntervals, dt)
                    if #FidelityWoW_Export.castIntervals > 100 then table.remove(FidelityWoW_Export.castIntervals, 1) end
                end
            end
        end
        lastCastTimeMs = timeMs

        -- Compute True Shannon Entropy
        self:ComputeShannonEntropy()
    end
end

function SomaticFlow:ComputeShannonEntropy()
    if #castIntervals < 5 then return end

    -- True Shannon Entropy over 50ms histogram bins
    local binWidthMs = 50
    local maxTimeMs = 3000
    local numBins = math.ceil(maxTimeMs / binWidthMs)
    local bins = {}
    for i = 1, numBins do bins[i] = 0 end

    for _, dt in ipairs(castIntervals) do
        local binIdx = math.min(numBins, math.max(1, math.floor(dt / binWidthMs) + 1))
        bins[binIdx] = bins[binIdx] + 1
    end

    local H = 0
    local N = #castIntervals
    for _, count in ipairs(bins) do
        if count > 0 then
            local p = count / N
            H = H - (p * (math.log(p) / math.log(2))) -- log2(p)
        end
    end

    FidelityWoW_Telemetry.shannonEntropyBits = tonumber(string.format("%.3f", H))

    -- Rotation bot check: H < 0.80 bits
    FidelityWoW_Telemetry.rotationBotting = H < 0.80

    -- Frantic click strain penalty
    local mean = 0
    for _, dt in ipairs(castIntervals) do mean = mean + dt end
    mean = mean / #castIntervals
    if mean < 200 then
        FidelityWoW_Telemetry.strainJoules = FidelityWoW_Telemetry.strainJoules + 0.05
    end
end

function SomaticFlow:ComputeFlowState(timeMs)
    if not FidelityWoW_Config.enabled then return end

    local entropy = FidelityWoW_Telemetry.shannonEntropyBits or 2.5
    local ftle = FidelityWoW_Telemetry.lyapunovFTLE or 0.005

    local pxd = FidelityWoW_Telemetry.inCombat and 0.45 or 0.15
    local vtx = math.min(0.95, math.max(0.10, entropy / 3.5))
    local lx = (FidelityWoW_Telemetry.strainJoules > 2.0 or ftle > 0.010 or FidelityWoW_Telemetry.inhumanKickDetected) and 0.60 or 0.98
    local aq = math.max(0.05, 0.30 - (FidelityWoW_Telemetry.strainJoules * 0.02))

    FidelityWoW_Telemetry.fourFloats = {
        Pxd = tonumber(string.format("%.3f", pxd)),
        Vtx = tonumber(string.format("%.3f", vtx)),
        Lx = tonumber(string.format("%.3f", lx)),
        Aq = tonumber(string.format("%.3f", aq))
    }

    FidelityWoW_Telemetry.coherence = tonumber(string.format("%.2f", (lx + (1.0 - ftle * 10)) / 2.0))
end

function SomaticFlow:PrintAudit()
    local H = FidelityWoW_Telemetry.shannonEntropyBits or 0
    local kick = FidelityWoW_Telemetry.lastReactionMs
    print("|cff00ffcc[Fidelity Somatic & APM Audit]|r")
    print(string.format("  Shannon Entropy H: %.3f bits (Threshold >= 0.80 bits)", H))
    print(string.format("  Rotation Cadence: %s", (H >= 0.80) and "|cff00ff00Organic Human Flow|r" or "|cffff0000Deterministic Automation|r"))
    if kick then
        print(string.format("  Last Interrupt Latency: %.1f ms (%s)", kick, FidelityWoW_Telemetry.lastReactionVerdict or "untested"))
    else
        print("  Last Interrupt Latency: None recorded.")
    end
end
