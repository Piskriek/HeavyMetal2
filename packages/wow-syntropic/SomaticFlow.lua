-- SomaticFlow.lua - APM Shannon Entropy, Reaction Latency, and Somatic Strain Monitor
-- Distinguishes human organic flow from synthetic rotation botting and auto-kick injection

local ADDON_NAME, ns = ...
local SomaticFlow = {}
ns.SomaticFlow = SomaticFlow

local castIntervals = {}
local MAX_INTERVALS = 30
local lastCastTimeMs = 0
local enemyCastStartTimes = {}

-- Unified thresholds (classify observed combat-log elapsed intervals)
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
    if not FidelityWoW_Config.enabled or not FidelityWoW_Config.optIn then return end

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
                print(string.format("|cffff0000[Fidelity Warden ALERT]|r Inhuman reaction time: %.1f ms (< %.0fms robotic threshold).", reactionTimeMs, ROBOTIC_INJECTION_THRESHOLD_MS))
            elseif reactionTimeMs < PREDICTIVE_THRESHOLD_MS then
                verdict = "predictive_timing"
                FidelityWoW_Telemetry.inhumanKickDetected = false
                print(string.format("|cffffcc00[Fidelity Warden]|r Fast predictive interrupt: %.1f ms.", reactionTimeMs))
            else
                verdict = "human_reflex"
                FidelityWoW_Telemetry.inhumanKickDetected = false
                print(string.format("|cff00ff00[Fidelity Flow]|r Observed reflex window: %.1f ms.", reactionTimeMs))
            end

            FidelityWoW_Telemetry.lastReactionMs = reactionTimeMs
            FidelityWoW_Telemetry.lastReactionVerdict = verdict

            if FidelityWoW_Export then
                table.insert(FidelityWoW_Export.interrupts, {
                    reactionTimeMs = reactionTimeMs,
                    confirmedInterrupt = true,
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
    if not FidelityWoW_Config.enabled or not FidelityWoW_Config.optIn then return end

    if event == "UNIT_SPELLCAST_SUCCEEDED" then
        if lastCastTimeMs > 0 then
            local dt = (timeMs - lastCastTimeMs) -- in ms
            if dt >= 200 and dt <= 3500 then
                table.insert(castIntervals, dt)
                if #castIntervals > MAX_INTERVALS then table.remove(castIntervals, 1) end

                if FidelityWoW_Export then
                    table.insert(FidelityWoW_Export.castIntervals, dt)
                    if #FidelityWoW_Export.castIntervals > 100 then table.remove(FidelityWoW_Export.castIntervals, 1) end
                end
            end
        end
        lastCastTimeMs = timeMs
    end
end

function SomaticFlow:ComputeFlowState(timeMs)
    if #castIntervals < 5 then return end

    -- Shannon Entropy calculation across 50ms bins in [200ms, 3500ms]
    local MIN_MS = 200
    local MAX_MS = 3500
    local BIN_WIDTH = 50
    local numBins = math.ceil((MAX_MS - MIN_MS) / BIN_WIDTH)
    local bins = {}
    for i = 1, numBins do bins[i] = 0 end

    for _, dt in ipairs(castIntervals) do
        local binIdx = math.min(numBins, math.max(1, math.floor((dt - MIN_MS) / BIN_WIDTH) + 1))
        bins[binIdx] = bins[binIdx] + 1
    end

    local H = 0
    local N = #castIntervals
    for i = 1, numBins do
        if bins[i] > 0 then
            local p = bins[i] / N
            H = H - (p * (math.log(p) / math.log(2)))
        end
    end

    FidelityWoW_Telemetry.shannonEntropyBits = tonumber(string.format("%.3f", H))
    FidelityWoW_Telemetry.rotationBotting = H < 0.80

    -- APM calculation
    local apm = math.min(300, math.max(0, math.floor((60000 / math.max(200, (castIntervals[#castIntervals] or 1000))))))
    FidelityWoW_Telemetry.apm = apm
end

function SomaticFlow:PrintAudit()
    local H = FidelityWoW_Telemetry.shannonEntropyBits or 2.5
    local lastReact = FidelityWoW_Telemetry.lastReactionMs or 0
    print("|cff00ffcc[Fidelity Somatic Flow Audit]|r")
    print(string.format("  Shannon Entropy (H): %.3f bits (Limit >= 0.80 bits)", H))
    print(string.format("  Last Reaction Time: %.1f ms", lastReact))
    if H >= 0.80 and not FidelityWoW_Telemetry.inhumanKickDetected then
        print("  |cff00ff00[PASS]|r Cognitive flow & somatic cadence verified organic.")
    else
        print("  |cffff0000[WARN]|r Low entropy or inhuman reaction observed.")
    end
end
