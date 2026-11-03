-- Core.lua - Fidelity Syntropic Flow & Warden
-- Connects in-game WoW client events to the 4-Node Tetrahedral Holon

local ADDON_NAME, ns = ...
local FidelityWoW = CreateFrame("Frame", "FidelityWoWFrame")
ns.FidelityWoW = FidelityWoW

-- Global Configuration & Consent Opt-in Gate
FidelityWoW_Config = FidelityWoW_Config or {
    enabled = true,
    optIn = false, -- Epistemic Consent Gate: Opt-in required for telemetry export
    hudVisible = true,
    sampleRateHz = 20
}

-- Ring Buffer Export for External Bridge
FidelityWoW_Export = FidelityWoW_Export or {
    version = 2,
    trajectories = {},
    interrupts = {},
    castIntervals = {},
    lastExportTimestamp = 0
}

FidelityWoW_Telemetry = FidelityWoW_Telemetry or {
    sessionStart = 0,
    character = "",
    realm = "",
    ticks = 0,
    coherence = 0.99,
    activeRung = "D3",
    fourFloats = { Pxd = 0.20, Vtx = 0.50, Lx = 0.95, Aq = 0.20 },
    strainJoules = 0.0,
    lyapunovFTLE = 0.005,
    shannonEntropyBits = 2.5
}

local function GetPrecisionTimeMs()
    return debugprofilestop and debugprofilestop() or (GetTime() * 1000)
end

function FidelityWoW:OnLoad()
    self:RegisterEvent("PLAYER_LOGIN")
    self:RegisterEvent("PLAYER_LOGOUT")
    self:RegisterEvent("COMBAT_LOG_EVENT_UNFILTERED")
    self:RegisterEvent("UNIT_SPELLCAST_SENT")
    self:RegisterEvent("UNIT_SPELLCAST_SUCCEEDED")
    self:RegisterEvent("PLAYER_STARTED_MOVING")
    self:RegisterEvent("PLAYER_STOPPED_MOVING")
    self:RegisterEvent("PLAYER_REGEN_DISABLED")
    self:RegisterEvent("PLAYER_REGEN_ENABLED")

    self:SetScript("OnEvent", self.OnEvent)
    self:SetScript("OnUpdate", self.OnUpdate)

    print("|cff00ffcc[Fidelity WoW]|r Syntropic Flow & Kinematic Warden initialized. Type |cffffcc00/fidelity|r for options.")
end

function FidelityWoW:OnEvent(event, ...)
    -- Strict Enforcement: If disabled, stop all event processing immediately
    if not FidelityWoW_Config.enabled then return end

    if event == "PLAYER_LOGIN" then
        FidelityWoW_Telemetry.character = UnitName("player") or "Unknown"
        FidelityWoW_Telemetry.realm = GetRealmName() or "Unknown"
        FidelityWoW_Telemetry.sessionStart = time()
        if ns.UI and ns.UI.InitHUD then ns.UI:InitHUD() end

    elseif event == "COMBAT_LOG_EVENT_UNFILTERED" then
        if ns.SomaticFlow and ns.SomaticFlow.OnCombatLogEvent then
            ns.SomaticFlow:OnCombatLogEvent(CombatLogGetCurrentEventInfo())
        end

    elseif event == "UNIT_SPELLCAST_SENT" or event == "UNIT_SPELLCAST_SUCCEEDED" then
        local unit, target, castGUID, spellID = ...
        if unit == "player" and ns.SomaticFlow then
            ns.SomaticFlow:OnPlayerCast(event, spellID, target, GetPrecisionTimeMs())
        end

    elseif event == "PLAYER_STARTED_MOVING" or event == "PLAYER_STOPPED_MOVING" then
        if ns.Kinematics then
            ns.Kinematics:OnMovementStateChange(event == "PLAYER_STARTED_MOVING", GetPrecisionTimeMs())
        end

    elseif event == "PLAYER_REGEN_DISABLED" then
        FidelityWoW_Telemetry.activeRung = "D3"
        FidelityWoW_Telemetry.inCombat = true

    elseif event == "PLAYER_REGEN_ENABLED" then
        FidelityWoW_Telemetry.inCombat = false
        FidelityWoW_Telemetry.strainJoules = math.max(0.0, FidelityWoW_Telemetry.strainJoules - 0.5)
    end
end

local lastUpdateMs = 0

function FidelityWoW:OnUpdate(elapsed)
    -- Strict Enforcement: If disabled, stop sampling immediately
    if not FidelityWoW_Config.enabled then return end

    local nowMs = GetPrecisionTimeMs()
    if nowMs - lastUpdateMs < 50 then return end -- 20Hz update tick
    lastUpdateMs = nowMs

    FidelityWoW_Telemetry.ticks = FidelityWoW_Telemetry.ticks + 1

    -- Kinematic sampling
    if ns.Kinematics and ns.Kinematics.SampleTick then
        ns.Kinematics:SampleTick(nowMs)
    end

    -- Somatic flow calculation
    if ns.SomaticFlow and ns.SomaticFlow.ComputeFlowState then
        ns.SomaticFlow:ComputeFlowState(nowMs)
    end

    -- UI Refresh
    if ns.UI and ns.UI.UpdateHUD then
        ns.UI:UpdateHUD()
    end
end

-- Slash Commands
SLASH_FIDELITY1 = "/fidelity"
SlashCmdList["FIDELITY"] = function(msg)
    local cmd = string.lower(string.trim(msg or ""))
    if cmd == "toggle" then
        FidelityWoW_Config.hudVisible = not FidelityWoW_Config.hudVisible
        if ns.UI and ns.UI.ToggleHUD then ns.UI:ToggleHUD(FidelityWoW_Config.hudVisible) end
    elseif cmd == "optin" then
        FidelityWoW_Config.optIn = not FidelityWoW_Config.optIn
        print(string.format("|cff00ffcc[Fidelity WoW]|r Telemetry Export Opt-in is now: %s", FidelityWoW_Config.optIn and "|cff00ff00ENABLED|r" or "|cffff0000DISABLED|r"))
    elseif cmd == "enable" then
        FidelityWoW_Config.enabled = not FidelityWoW_Config.enabled
        print(string.format("|cff00ffcc[Fidelity WoW]|r Addon is now: %s", FidelityWoW_Config.enabled and "|cff00ff00ENABLED|r" or "|cffff0000DISABLED (sampling stopped)|r"))
    elseif cmd == "audit" then
        if ns.Kinematics and ns.Kinematics.PrintAudit then ns.Kinematics:PrintAudit() end
        if ns.SomaticFlow and ns.SomaticFlow.PrintAudit then ns.SomaticFlow:PrintAudit() end
    else
        print("|cff00ffcc[Fidelity WoW Commands]|r")
        print("  |cffffcc00/fidelity toggle|r - Show/Hide Syntropic HUD")
        print("  |cffffcc00/fidelity optin|r  - Toggle Telemetry Export Opt-in Gate")
        print("  |cffffcc00/fidelity enable|r - Toggle Addon Sampling On/Off")
        print("  |cffffcc00/fidelity audit|r  - Run instant Invariant Audit")
    end
end

FidelityWoW:OnLoad()
