-- UI.lua - Sleek In-Game HUD for Fidelity Syntropic Flow & Warden

local ADDON_NAME, ns = ...
local UI = {}
ns.UI = UI

local hudFrame

function UI:InitHUD()
    if hudFrame then return end

    hudFrame = CreateFrame("Frame", "FidelityWoWHUD", UIParent, "BackdropTemplate")
    hudFrame:SetSize(230, 115)
    hudFrame:SetPoint("TOPRIGHT", UIParent, "TOPRIGHT", -50, -250)
    hudFrame:SetMovable(true)
    hudFrame:EnableMouse(true)
    hudFrame:RegisterForDrag("LeftButton")
    hudFrame:SetScript("OnDragStart", hudFrame.StartMoving)
    hudFrame:SetScript("OnDragStop", hudFrame.StopMovingOrSizing)

    hudFrame:SetBackdrop({
        bgFile = "Interface\\Buttons\\WHITE8X8",
        edgeFile = "Interface\\Buttons\\WHITE8X8",
        edgeSize = 1,
        insets = { left = 1, right = 1, top = 1, bottom = 1 }
    })
    hudFrame:SetBackdropColor(0.04, 0.06, 0.10, 0.85)
    hudFrame:SetBackdropBorderColor(0.0, 0.8, 0.7, 0.9)

    -- Title Label
    local title = hudFrame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    title:SetPoint("TOPLEFT", 10, -8)
    title:SetText("|cff00ffccFIDELITY|r |cffffffffSYNTROPIC FLOW|r")

    -- Coherence Text
    local coherenceText = hudFrame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    coherenceText:SetPoint("TOPLEFT", 10, -26)
    hudFrame.coherenceText = coherenceText

    -- Density Rung Text
    local rungText = hudFrame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    rungText:SetPoint("TOPLEFT", 10, -42)
    hudFrame.rungText = rungText

    -- FTLE & True Shannon Entropy
    local metricsText = hudFrame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    metricsText:SetPoint("TOPLEFT", 10, -58)
    hudFrame.metricsText = metricsText

    -- Invariant Status Indicator
    local statusText = hudFrame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    statusText:SetPoint("TOPLEFT", 10, -74)
    hudFrame.statusText = statusText

    -- Four-Floats Vector & Opt-in Indicator
    local footerText = hudFrame:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
    footerText:SetPoint("BOTTOMLEFT", 10, 8)
    hudFrame.footerText = footerText

    if not FidelityWoW_Config.hudVisible then
        hudFrame:Hide()
    end
end

function UI:UpdateHUD()
    if not hudFrame or not hudFrame:IsShown() then return end

    local coh = FidelityWoW_Telemetry.coherence or 0.99
    local rung = FidelityWoW_Telemetry.activeRung or "D3"
    local ftle = FidelityWoW_Telemetry.lyapunovFTLE or 0.005
    local entropy = FidelityWoW_Telemetry.shannonEntropyBits or 2.50
    local strain = FidelityWoW_Telemetry.strainJoules or 0.0
    local ff = FidelityWoW_Telemetry.fourFloats or { Pxd = 0.2, Vtx = 0.5, Lx = 0.95, Aq = 0.2 }
    local optIn = FidelityWoW_Config.optIn

    hudFrame.coherenceText:SetText(string.format("Coherence: |cff00ff00%.0f%%|r | Strain: |cffffcc00%.2f J|r", coh * 100, strain))
    hudFrame.rungText:SetText(string.format("Active Rung: |cff00e5ff%s|r (Somatic Vessel)", rung))
    hudFrame.metricsText:SetText(string.format("λ(FTLE): %.3f | H: %.2f bits", ftle, entropy))

    if ftle > 0.010 or FidelityWoW_Telemetry.inhumanKickDetected or FidelityWoW_Telemetry.rotationBotting then
        hudFrame.statusText:SetText("Invariant: |cffff0000DEVIANT (Anomaly Detected)|r")
        hudFrame:SetBackdropBorderColor(1.0, 0.2, 0.2, 0.9)
    else
        hudFrame.statusText:SetText("Invariant: |cff00ff00NOMINAL (Organic Flow)|r")
        hudFrame:SetBackdropBorderColor(0.0, 0.8, 0.7, 0.9)
    end

    hudFrame.footerText:SetText(string.format("S=(%.2f,%.2f,%.2f,%.2f) | OptIn:%s", ff.Pxd or 0, ff.Vtx or 0, ff.Lx or 0, ff.Aq or 0, optIn and "|cff00ff00ON|r" or "|cffff8800OFF|r"))
end

function UI:ToggleHUD(show)
    if not hudFrame then self:InitHUD() end
    if show then hudFrame:Show() else hudFrame:Hide() end
end
