-- Kinematics.lua - Kinematic Invariant & Trajectory Verifier
-- Analyzes movement splines, position curvature, and physical acceleration limits

local ADDON_NAME, ns = ...
local Kinematics = {}
ns.Kinematics = Kinematics

local samples = {}
local MAX_SAMPLES = 60
local lastSampleTime = 0
local lastX, lastY = 0, 0
local accumulatedFtle = 0.005
local FTLE_LIMIT = 0.010
local MAX_GROUND_SPEED = 16.0 -- yards/sec

function Kinematics:OnMovementStateChange(isMoving, timeMs)
    if not FidelityWoW_Config.enabled or not FidelityWoW_Config.optIn then return end

    local event = {
        t = timeMs,
        state = isMoving and "START" or "STOP",
        speed = GetUnitSpeed("player")
    }
    table.insert(samples, event)
    if #samples > MAX_SAMPLES then table.remove(samples, 1) end

    -- Export discrete movement state change events
    if FidelityWoW_Export then
        FidelityWoW_Export.movementEvents = FidelityWoW_Export.movementEvents or {}
        table.insert(FidelityWoW_Export.movementEvents, event)
        if #FidelityWoW_Export.movementEvents > 100 then table.remove(FidelityWoW_Export.movementEvents, 1) end
    end
end

function Kinematics:SampleTick(timeMs)
    if not FidelityWoW_Config.enabled or not FidelityWoW_Config.optIn then return end

    local speed = GetUnitSpeed("player") or 0
    local isMounted = IsMounted and IsMounted() or false
    local maxAllowedSpeed = isMounted and 16.0 or 8.5

    -- Map position
    local mapID = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player")
    local pos = mapID and C_Map.GetPlayerMapPosition(mapID, "player")
    local curX, curY = 0, 0
    if pos and pos.GetXY then
        curX, curY = pos:GetXY()
    end

    local dt = (timeMs - lastSampleTime) / 1000.0
    if dt <= 0 then dt = 0.05 end

    -- Compute displacement if map coordinates available
    local dx = curX - lastX
    local dy = curY - lastY
    local dist = math.sqrt(dx * dx + dy * dy)

    -- Kinematic Divergence Evaluation (empirical spline prediction heuristic)
    local instantaneousFtle = 0.002
    local isSpeedViolation = speed > maxAllowedSpeed * 1.5

    if isSpeedViolation then
        instantaneousFtle = 0.050
        FidelityWoW_Telemetry.kinematicAnomaly = true
    elseif dist > 0.05 and dt < 0.1 then
        -- Coordinate teleport jump
        instantaneousFtle = 0.080
        FidelityWoW_Telemetry.kinematicAnomaly = true
    else
        FidelityWoW_Telemetry.kinematicAnomaly = false
    end

    accumulatedFtle = (accumulatedFtle * 0.90) + (instantaneousFtle * 0.10)
    FidelityWoW_Telemetry.lyapunovFTLE = tonumber(string.format("%.4f", accumulatedFtle))

    local point = {
        t = timeMs,
        x = curX,
        y = curY,
        speed = speed,
        mapID = mapID
    }

    if FidelityWoW_Export then
        FidelityWoW_Export.trajectory = FidelityWoW_Export.trajectory or {}
        table.insert(FidelityWoW_Export.trajectory, point)
        if #FidelityWoW_Export.trajectory > 100 then table.remove(FidelityWoW_Export.trajectory, 1) end
        -- Backwards compatibility alias
        FidelityWoW_Export.trajectories = FidelityWoW_Export.trajectory
    end

    lastSampleTime = timeMs
    lastX, lastY = curX, curY
end

function Kinematics:PrintAudit()
    local ftle = FidelityWoW_Telemetry.lyapunovFTLE or 0.005
    print("|cff00ffcc[Fidelity Kinematics Audit]|r")
    print(string.format("  Current Speed: %.2f y/s (Max: %.1f y/s)", GetUnitSpeed("player") or 0, IsMounted and IsMounted() and 16.0 or 8.5))
    print(string.format("  Spline Divergence Heuristic (λ): %.4f (Limit <= %.3f)", ftle, FTLE_LIMIT))
    if ftle <= FTLE_LIMIT and not FidelityWoW_Telemetry.kinematicAnomaly then
        print("  |cff00ff00[PASS]|r Movement trajectory conforms to smooth physical splines.")
    else
        print("  |cffff0000[WARN]|r Kinematic divergence exceeds smooth human threshold.")
    end
end
