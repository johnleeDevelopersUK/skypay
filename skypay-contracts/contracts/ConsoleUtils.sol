// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/console.sol";
import "../../contracts/SkyPayVault.sol";
import "../../contracts/SkyPayRouter.sol";
import "../../contracts/SkyPayWallet.sol";
import "../../contracts/SkyPayRelayer.sol";
import "../../contracts/ComplianceModule.sol";
import "../../contracts/LiquidityPool.sol";
import "../../contracts/BridgeAdapter.sol";
import "../../contracts/SkyPayGovernor.sol";
import "../../contracts/ISkyPayVault.sol";
import "../../contracts/ISkyPayRouter.sol";
import "../../contracts/IComplianceModule.sol";

contract ConsoleUtils {
    // Color codes for console output
    string constant RED = "\u001b[31m";
    string constant GREEN = "\u001b[32m";
    string constant YELLOW = "\u001b[33m";
    string constant BLUE = "\u001b[34m";
    string constant MAGENTA = "\u001b[35m";
    string constant CYAN = "\u001b[36m";
    string constant RESET = "\u001b[0m";
    
    // Separator line
    string constant SEPARATOR = "========================================";
    string constant DASHED_LINE = "----------------------------------------";

    // Event logs tracking
    struct EventLog {
        string contractName;
        string eventName;
        address sender;
        uint256 timestamp;
        bytes data;
    }
    
    EventLog[] public eventLogs;
    
    // Console utilities for SkyPayVault
    function logVaultState(SkyPayVault vault) public view {
        console.log("\n%s%s VAULT STATE %s%s", BLUE, SEPARATOR, SEPARATOR, RESET);
        
        // Get total value locked
        uint256 tvl = vault.getTotalValueLocked();
        console.log("Total Value Locked: %s%.2f ETH%s", GREEN, _toETH(tvl), RESET);
        
        // Get supported tokens
        address[] memory tokens = vault.getSupportedTokens();
        console.log("\nSupported Tokens (%d):", tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            ISkyPayVault.TokenInfo memory info = vault.getTokenInfo(tokens[i]);
            console.log("  [%d] %s:", i, _getTokenSymbol(tokens[i]));
            console.log("    Pool: %s", info.pool);
            console.log("    Enabled: %s", info.enabled ? "✅" : "❌");
            console.log("    Total Deposits: %s", _formatAmount(info.totalDeposits, tokens[i]));
            console.log("    Total Shares: %s", _formatNumber(info.totalShares));
            console.log("    Performance Fee: %s%%", _formatPercentage(info.performanceFee));
            console.log("    Withdrawal Fee: %s%%", _formatPercentage(info.withdrawalFee));
        }
        
        // Get strategies
        ISkyPayVault.Strategy[] memory strategies = vault.getStrategies();
        console.log("\nActive Strategies (%d):", strategies.length);
        
        for (uint256 i = 0; i < strategies.length; i++) {
            console.log("  [%d] Strategy: %s", i, strategies[i].implementation);
            console.log("    Active: %s", strategies[i].active ? "✅" : "❌");
            console.log("    Allocated: %s", _formatAmount(strategies[i].allocated, address(0)));
            console.log("    Performance: %s%%", _formatPercentage(strategies[i].performance));
        }
    }
    
    function logVaultUserPosition(SkyPayVault vault, address user) public view {
        console.log("\n%s%s USER VAULT POSITION %s%s", CYAN, DASHED_LINE, DASHED_LINE, RESET);
        console.log("User: %s", user);
        
        address[] memory tokens = vault.getSupportedTokens();
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < tokens.length; i++) {
            (uint256 amount, uint256 shares) = vault.getUserBalance(user, tokens[i]);
            if (amount > 0) {
                uint256 price = _getTokenPrice(tokens[i]);
                uint256 value = amount * price / 1e18;
                totalValue += value;
                
                console.log("\n  Token: %s", _getTokenSymbol(tokens[i]));
                console.log("    Amount: %s", _formatAmount(amount, tokens[i]));
                console.log("    Shares: %s", _formatNumber(shares));
                console.log("    Value: $%.2f", _toUSD(value));
                
                // Calculate share price
                ISkyPayVault.TokenInfo memory info = vault.getTokenInfo(tokens[i]);
                if (info.totalShares > 0) {
                    uint256 sharePrice = info.totalDeposits * 1e18 / info.totalShares;
                    console.log("    Share Price: %s per share", _formatAmount(sharePrice, tokens[i]));
                }
            }
        }
        
        console.log("\n%sTotal Portfolio Value: $%.2f%s", GREEN, _toUSD(totalValue), RESET);
    }
    
    // Console utilities for SkyPayRouter
    function logRouterState(SkyPayRouter router) public view {
        console.log("\n%s%s ROUTER STATE %s%s", MAGENTA, SEPARATOR, SEPARATOR, RESET);
        
        // Get swap fee
        uint256 swapFee = router.getSwapFee();
        console.log("Swap Fee: %s%%", _formatPercentage(swapFee));
        
        // Get routes
        (bytes32[] memory routeIds, ISkyPayRouter.Route[] memory routes) = router.getRoutes();
        console.log("\nRegistered Routes (%d):", routeIds.length);
        
        for (uint256 i = 0; i < routeIds.length; i++) {
            console.log("  [%d] Route ID: %s", i, _bytes32ToString(routeIds[i]));
            console.log("    Handler: %s", routes[i].handler);
            console.log("    Active: %s", routes[i].active ? "✅" : "❌");
            console.log("    Priority: %d", routes[i].priority);
        }
    }
    
    function calculateAndLogSwap(
        SkyPayRouter router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view {
        console.log("\n%s%s SWAP CALCULATION %s%s", YELLOW, DASHED_LINE, DASHED_LINE, RESET);
        
        console.log("Token In: %s (%s)", _getTokenSymbol(tokenIn), tokenIn);
        console.log("Token Out: %s (%s)", _getTokenSymbol(tokenOut), tokenOut);
        console.log("Amount In: %s", _formatAmount(amountIn, tokenIn));
        
        // Calculate best route
        (address handler, uint256 amountOut, bytes memory routeData) = router.getBestRoute(
            tokenIn,
            tokenOut,
            amountIn
        );
        
        console.log("\nBest Route:");
        console.log("  Handler: %s", handler);
        console.log("  Expected Output: %s", _formatAmount(amountOut, tokenOut));
        
        if (routeData.length > 0) {
            console.log("  Route Data: %s", _bytesToHex(routeData));
        }
        
        // Calculate swap fee
        uint256 swapFee = router.getSwapFee();
        uint256 feeAmount = amountIn * swapFee / 10000;
        uint256 amountInAfterFee = amountIn - feeAmount;
        
        console.log("\nFee Breakdown:");
        console.log("  Swap Fee: %s%% (%s)", _formatPercentage(swapFee), _formatAmount(feeAmount, tokenIn));
        console.log("  Amount After Fee: %s", _formatAmount(amountInAfterFee, tokenIn));
        
        // Get estimated gas
        SkyPayRouter.SwapParams memory params = SkyPayRouter.SwapParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            amountOutMin: amountOut * 99 / 100, // 1% slippage
            recipient: address(this),
            deadline: block.timestamp + 1 hours,
            routeData: routeData
        });
        
        try router.estimateGasForSwap(params) returns (uint256 gasEstimate) {
            console.log("  Estimated Gas: %d", gasEstimate);
        } catch {
            console.log("  Gas estimation failed");
        }
    }
    
    // Console utilities for ComplianceModule
    function logComplianceState(ComplianceModule compliance) public view {
        console.log("\n%s%s COMPLIANCE STATE %s%s", RED, SEPARATOR, SEPARATOR, RESET);
        
        // Get compliance stats
        uint256 sanctionedCount = 0;
        uint256 pepCount = 0;
        
        // Note: In production, you would have methods to get counts
        console.log("Compliance Module: %s", address(compliance));
        
        // Check some test addresses
        address[] memory testAddresses = new address[](3);
        testAddresses[0] = 0x0000000000000000000000000000000000000000;
        testAddresses[1] = 0x0000000000000000000000000000000000000001;
        testAddresses[2] = address(this);
        
        console.log("\nTest Address Checks:");
        for (uint256 i = 0; i < testAddresses.length; i++) {
            bool isSanctioned = compliance.isSanctioned(testAddresses[i]);
            bool isPEP = compliance.isPEP(testAddresses[i]);
            
            console.log("  [%d] %s:", i, testAddresses[i]);
            console.log("    Sanctioned: %s", isSanctioned ? "🔴" : "🟢");
            console.log("    PEP: %s", isPEP ? "⚠️" : "✅");
            
            if (isSanctioned) sanctionedCount++;
            if (isPEP) pepCount++;
        }
        
        console.log("\nSummary:");
        console.log("  Sanctioned Addresses: %d", sanctionedCount);
        console.log("  PEP Addresses: %d", pepCount);
    }
    
    function assessTransactionCompliance(
        ComplianceModule compliance,
        address from,
        address to,
        uint256 amount,
        address token
    ) public view {
        console.log("\n%s%s TRANSACTION COMPLIANCE ASSESSMENT %s%s", RED, DASHED_LINE, DASHED_LINE, RESET);
        
        console.log("From: %s", from);
        console.log("To: %s", to);
        console.log("Amount: %s %s", _formatAmount(amount, token), _getTokenSymbol(token));
        
        IComplianceModule.RiskAssessment memory assessment = compliance.assessTransaction(
            from,
            to,
            amount,
            token
        );
        
        console.log("\nRisk Assessment:");
        console.log("  Risk Score: %d/100", assessment.riskScore);
        
        // Color code risk level
        string memory riskColor;
        string memory riskLevel;
        
        if (assessment.riskScore >= 80) {
            riskColor = RED;
            riskLevel = "CRITICAL 🔴";
        } else if (assessment.riskScore >= 60) {
            riskColor = YELLOW;
            riskLevel = "HIGH 🟡";
        } else if (assessment.riskScore >= 40) {
            riskColor = BLUE;
            riskLevel = "MEDIUM 🔵";
        } else {
            riskColor = GREEN;
            riskLevel = "LOW 🟢";
        }
        
        console.log("  Risk Level: %s%s%s", riskColor, riskLevel, RESET);
        console.log("  Requires Review: %s", assessment.requiresReview ? "✅" : "❌");
        console.log("  Blocked: %s", assessment.isBlocked ? "🔴" : "🟢");
        
        if (assessment.flags.length > 0) {
            console.log("\n  Flags:");
            for (uint256 i = 0; i < assessment.flags.length; i++) {
                console.log("    - %s", assessment.flags[i]);
            }
        }
        
        // Check if transfer is allowed
        bool canTransfer = compliance.canTransfer(from, to, amount);
        console.log("\nTransfer Allowed: %s", canTransfer ? "✅ YES" : "❌ NO");
    }
    
    // Console utilities for LiquidityPool
    function logLiquidityPoolState(LiquidityPool pool) public view {
        console.log("\n%s%s LIQUIDITY POOL STATE %s%s", GREEN, SEPARATOR, SEPARATOR, RESET);
        
        // Get TVL
        uint256 tvl = pool.getTotalValueLocked();
        console.log("Total Value Locked: $%.2f", _toUSD(tvl));
        
        // Get swap fee
        try pool.getSwapFee() returns (uint256 fee) {
            console.log("Swap Fee: %s%%", _formatPercentage(fee));
        } catch {}
        
        // Get supported tokens
        address[] memory tokens = pool.getSupportedTokens();
        console.log("\nSupported Tokens (%d):", tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            ILiquidityPool.PoolInfo memory info = pool.getPoolInfo(tokens[i]);
            
            console.log("  [%d] %s:", i, _getTokenSymbol(tokens[i]));
            console.log("    Total Liquidity: %s", _formatAmount(info.totalLiquidity, tokens[i]));
            console.log("    Total Shares: %s", _formatNumber(info.totalShares));
            console.log("    Virtual Balance: %s", _formatAmount(info.virtualBalance, tokens[i]));
            console.log("    Accumulated Fees: %s", _formatAmount(info.accumulatedFees, tokens[i]));
            
            // Calculate APR (simplified)
            if (info.lastUpdate > 0) {
                uint256 timeElapsed = block.timestamp - info.lastUpdate;
                uint256 feesPerDay = info.accumulatedFees * 1 days / timeElapsed;
                if (info.totalLiquidity > 0) {
                    uint256 apr = feesPerDay * 365 * 10000 / info.totalLiquidity;
                    console.log("    Estimated APR: %s%%", _formatPercentage(apr));
                }
            }
        }
    }
    
    function calculateAndLogPoolSwap(
        LiquidityPool pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view {
        console.log("\n%s%s POOL SWAP CALCULATION %s%s", GREEN, DASHED_LINE, DASHED_LINE, RESET);
        
        console.log("Token In: %s (%s)", _getTokenSymbol(tokenIn), tokenIn);
        console.log("Token Out: %s (%s)", _getTokenSymbol(tokenOut), tokenOut);
        console.log("Amount In: %s", _formatAmount(amountIn, tokenIn));
        
        try pool.calculateSwap(tokenIn, tokenOut, amountIn) returns (uint256 amountOut, uint256 fee) {
            console.log("\nSwap Calculation:");
            console.log("  Amount Out: %s", _formatAmount(amountOut, tokenOut));
            console.log("  Fee: %s (%s%%)", _formatAmount(fee, tokenIn), _formatPercentage(fee * 10000 / amountIn));
            console.log("  Price Impact: %.2f%%", _calculatePriceImpact(pool, tokenIn, tokenOut, amountIn, amountOut));
            
            // Get spot price
            uint256 spotPrice = pool.getSpotPrice(tokenIn, tokenOut);
            uint256 effectivePrice = amountIn * 1e18 / amountOut;
            uint256 slippage = (spotPrice > effectivePrice) ? 
                (spotPrice - effectivePrice) * 10000 / spotPrice : 
                (effectivePrice - spotPrice) * 10000 / effectivePrice;
                
            console.log("  Spot Price: 1 %s = %s %s", 
                _getTokenSymbol(tokenIn), 
                _formatAmount(spotPrice, tokenOut),
                _getTokenSymbol(tokenOut));
            console.log("  Effective Price: 1 %s = %s %s",
                _getTokenSymbol(tokenIn),
                _formatAmount(effectivePrice, tokenOut),
                _getTokenSymbol(tokenOut));
            console.log("  Slippage: %s%%", _formatPercentage(slippage));
        } catch {
            console.log("  Calculation failed - pool may be inactive");
        }
    }
    
    // Console utilities for BridgeAdapter
    function logBridgeState(BridgeAdapter bridge) public view {
        console.log("\n%s%s BRIDGE STATE %s%s", CYAN, SEPARATOR, SEPARATOR, RESET);
        
        // Get supported chains
        uint256[] memory chainIds = bridge.getSupportedChains();
        console.log("Supported Chains (%d):", chainIds.length);
        
        for (uint256 i = 0; i < chainIds.length; i++) {
            console.log("  [%d] Chain ID: %d", i, chainIds[i]);
            console.log("    Name: %s", _getChainName(chainIds[i]));
            
            // Get chain limits
            console.log("    Supported: %s", bridge.isChainSupported(chainIds[i]) ? "✅" : "❌");
        }
        
        // Get bridge fee
        try bridge.getBridgeFee() returns (uint256 fee) {
            console.log("\nBridge Fee: %s%%", _formatPercentage(fee));
        } catch {}
    }
    
    function calculateAndLogBridgeFee(
        BridgeAdapter bridge,
        address token,
        uint256 amount,
        uint256 destChain
    ) public view {
        console.log("\n%s%s BRIDGE FEE CALCULATION %s%s", CYAN, DASHED_LINE, DASHED_LINE, RESET);
        
        console.log("Token: %s (%s)", _getTokenSymbol(token), token);
        console.log("Amount: %s", _formatAmount(amount, token));
        console.log("Destination Chain: %d (%s)", destChain, _getChainName(destChain));
        
        if (!bridge.isChainSupported(destChain)) {
            console.log("%sERROR: Chain not supported%s", RED, RESET);
            return;
        }
        
        // Calculate fee
        uint256 fee = bridge.calculateBridgeFee(token, amount, destChain);
        uint256 netAmount = amount - fee;
        
        console.log("\nFee Breakdown:");
        console.log("  Bridge Fee: %s (%s%%)", 
            _formatAmount(fee, token),
            _formatPercentage(fee * 10000 / amount));
        console.log("  Amount After Fee: %s", _formatAmount(netAmount, token));
        console.log("  Receive Amount: ~%s", _formatAmount(netAmount, token));
        
        // Get estimated time
        uint256 estimatedTime = bridge.estimateBridgeTime(destChain);
        console.log("  Estimated Time: %s", _formatTime(estimatedTime));
        
        // Check limits
        try bridge.getChainMinAmount(destChain) returns (uint256 minAmount) {
            if (amount < minAmount) {
                console.log("%sWARNING: Amount below minimum (%s)%s", 
                    YELLOW, _formatAmount(minAmount, token), RESET);
            }
        } catch {}
        
        try bridge.getChainMaxAmount(destChain) returns (uint256 maxAmount) {
            if (maxAmount > 0 && amount > maxAmount) {
                console.log("%sWARNING: Amount above maximum (%s)%s", 
                    YELLOW, _formatAmount(maxAmount, token), RESET);
            }
        } catch {}
    }
    
    // Console utilities for SkyPayWallet
    function logWalletState(SkyPayWallet wallet) public view {
        console.log("\n%s%s WALLET STATE %s%s", BLUE, SEPARATOR, SEPARATOR, RESET);
        
        console.log("Wallet Address: %s", address(wallet));
        
        // Get nonce
        uint256 nonce = wallet.getNonce();
        console.log("Nonce: %d", nonce);
        
        // Get guardians
        address[] memory guardians = wallet.getGuardians();
        console.log("\nGuardians (%d):", guardians.length);
        
        for (uint256 i = 0; i < guardians.length; i++) {
            console.log("  [%d] %s", i, guardians[i]);
        }
        
        // Get daily limit
        uint256 dailyLimit = wallet.getDailyLimit();
        uint256 dailySpent = wallet.getDailySpent();
        uint256 remaining = dailyLimit > dailySpent ? dailyLimit - dailySpent : 0;
        
        console.log("\nDaily Limits:");
        console.log("  Limit: %s ETH", _toETH(dailyLimit));
        console.log("  Spent Today: %s ETH", _toETH(dailySpent));
        console.log("  Remaining: %s ETH", _toETH(remaining));
        
        // Check recovery status
        (address newOwner, uint256 unlockTime, uint256 confirmations) = wallet.getRecoveryRequest();
        if (newOwner != address(0)) {
            console.log("\nRecovery In Progress:");
            console.log("  New Owner: %s", newOwner);
            console.log("  Unlock Time: %s", _formatTimestamp(unlockTime));
            console.log("  Confirmations: %d/%d", confirmations, guardians.length);
            
            if (block.timestamp >= unlockTime) {
                console.log("  %sREADY TO COMPLETE%s", GREEN, RESET);
            } else {
                console.log("  Time Remaining: %s", _formatTime(unlockTime - block.timestamp));
            }
        }
    }
    
    // Console utilities for SkyPayRelayer
    function logRelayerState(SkyPayRelayer relayer) public view {
        console.log("\n%s%s RELAYER STATE %s%s", MAGENTA, SEPARATOR, SEPARATOR, RESET);
        
        console.log("Relayer Address: %s", address(relayer));
        
        // Get gas price
        uint256 gasPrice = relayer.getGasPrice();
        console.log("Gas Price: %d gwei", gasPrice / 1e9);
        
        // Get fee structure
        uint256 baseFee = relayer.getBaseFee();
        uint256 perByteFee = relayer.getPerByteFee();
        
        console.log("\nFee Structure:");
        console.log("  Base Fee: %s ETH", _toETH(baseFee));
        console.log("  Per Byte Fee: %d wei", perByteFee);
        
        // Get relayers
        address[] memory relayers = relayer.getRelayers();
        console.log("\nRegistered Relayers (%d):", relayers.length);
        
        for (uint256 i = 0; i < relayers.length; i++) {
            console.log("  [%d] %s", i, relayers[i]);
        }
        
        // Calculate example relay cost
        uint256 exampleGas = 100000;
        uint256 exampleData = 100;
        uint256 exampleCost = baseFee + (exampleGas * gasPrice) + (exampleData * perByteFee);
        
        console.log("\nExample Relay Cost:");
        console.log("  For 100k gas + 100 bytes data:");
        console.log("  Total Cost: %s ETH", _toETH(exampleCost));
    }
    
    // Console utilities for SkyPayGovernor
    function logGovernanceState(SkyPayGovernor governor) public view {
        console.log("\n%s%s GOVERNANCE STATE %s%s", YELLOW, SEPARATOR, SEPARATOR, RESET);
        
        console.log("Governor Address: %s", address(governor));
        
        // Get voting parameters
        uint256 votingDelay = governor.votingDelay();
        uint256 votingPeriod = governor.votingPeriod();
        uint256 proposalThreshold = governor.proposalThreshold();
        uint256 quorumPercentage = governor.quorum(block.number);
        
        console.log("\nGovernance Parameters:");
        console.log("  Voting Delay: %d blocks", votingDelay);
        console.log("  Voting Period: %d blocks", votingPeriod);
        console.log("  Proposal Threshold: %s tokens", _formatNumber(proposalThreshold));
        console.log("  Quorum Percentage: %s%%", _formatPercentage(quorumPercentage));
        
        // Get timelock
        address timelock = governor.timelock();
        console.log("  Timelock: %s", timelock);
        
        // Get token address
        address token = address(governor.token());
        console.log("  Governance Token: %s", token);
    }
    
    // Dashboard function - shows complete ecosystem state
    function showDashboard(
        SkyPayVault vault,
        SkyPayRouter router,
        ComplianceModule compliance,
        LiquidityPool pool,
        BridgeAdapter bridge,
        SkyPayWallet wallet,
        SkyPayRelayer relayer,
        SkyPayGovernor governor
    ) public view {
        console.log("\n%s%s SKYPAY ECOSYSTEM DASHBOARD %s%s", 
            MAGENTA, "=".repeat(20), "=".repeat(20), RESET);
        console.log("%sTimestamp: %s%s", CYAN, _formatTimestamp(block.timestamp), RESET);
        console.log("%sBlock: %d%s", CYAN, block.number, RESET);
        
        // Show quick stats
        console.log("\n%s📊 QUICK STATS%s", YELLOW, RESET);
        
        // Vault TVL
        try vault.getTotalValueLocked() returns (uint256 tvl) {
            console.log("  Vault TVL: $%.2f", _toUSD(tvl));
        } catch {}
        
        // Pool TVL
        try pool.getTotalValueLocked() returns (uint256 poolTVL) {
            console.log("  Pool TVL: $%.2f", _toUSD(poolTVL));
        } catch {}
        
        // Bridge status
        uint256[] memory chains = bridge.getSupportedChains();
        console.log("  Supported Chains: %d", chains.length);
        
        // Governance status
        console.log("  Governance: %s", address(governor) != address(0) ? "✅ Active" : "❌ Inactive");
        
        // Compliance status
        console.log("  Compliance: %s", address(compliance) != address(0) ? "✅ Active" : "❌ Inactive");
        
        // Show contract addresses
        console.log("\n%s🏗️ CONTRACT ADDRESSES%s", YELLOW, RESET);
        console.log("  Vault: %s", address(vault));
        console.log("  Router: %s", address(router));
        console.log("  Compliance: %s", address(compliance));
        console.log("  Liquidity Pool: %s", address(pool));
        console.log("  Bridge: %s", address(bridge));
        console.log("  Wallet: %s", address(wallet));
        console.log("  Relayer: %s", address(relayer));
        console.log("  Governor: %s", address(governor));
        
        // Show health status
        console.log("\n%s❤️ HEALTH STATUS%s", YELLOW, RESET);
        
        // Check if contracts are paused
        try vault.paused() {
            console.log("  Vault: %s", vault.paused() ? "🔴 Paused" : "🟢 Active");
        } catch {}
        
        try router.paused() {
            console.log("  Router: %s", router.paused() ? "🔴 Paused" : "🟢 Active");
        } catch {}
        
        try pool.paused() {
            console.log("  Pool: %s", pool.paused() ? "🔴 Paused" : "🟢 Active");
        } catch {}
        
        try bridge.paused() {
            console.log("  Bridge: %s", bridge.paused() ? "🔴 Paused" : "🟢 Active");
        } catch {}
        
        // Show recent events
        if (eventLogs.length > 0) {
            console.log("\n%s📝 RECENT EVENTS (%d)%s", YELLOW, eventLogs.length, RESET);
            
            uint256 start = eventLogs.length > 5 ? eventLogs.length - 5 : 0;
            for (uint256 i = start; i < eventLogs.length; i++) {
                EventLog memory log = eventLogs[i];
                console.log("  [%d] %s - %s", i, log.contractName, log.eventName);
                console.log("      From: %s", log.sender);
                console.log("      Time: %s", _formatTimestamp(log.timestamp));
            }
        }
    }
    
    // Event logging utility
    function logEvent(
        string memory contractName,
        string memory eventName,
        address sender,
        bytes memory data
    ) public {
        eventLogs.push(EventLog({
            contractName: contractName,
            eventName: eventName,
            sender: sender,
            timestamp: block.timestamp,
            data: data
        }));
        
        // Keep only last 100 events
        if (eventLogs.length > 100) {
            for (uint256 i = 0; i < eventLogs.length - 100; i++) {
                eventLogs[i] = eventLogs[i + eventLogs.length - 100];
            }
            // Resize array (not directly supported, but we simulate it)
            assembly {
                mstore(eventLogs, 100)
            }
        }
        
        console.log("%s[EVENT] %s.%s from %s%s", 
            GREEN, contractName, eventName, sender, RESET);
    }
    
    // Gas estimation utilities
    function estimateAndLogGas(
        string memory operation,
        function() external func
    ) public returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        func();
        uint256 gasAfter = gasleft();
        gasUsed = gasBefore - gasAfter;
        
        console.log("%s⛽ GAS ESTIMATION: %s%s", CYAN, operation, RESET);
        console.log("  Gas Used: %d", gasUsed);
        console.log("  Gas Cost: %s ETH", _toETH(gasUsed * tx.gasprice));
        
        return gasUsed;
    }
    
    function estimateBatchGas(
        string memory operation,
        function() external[] memory functions
    ) public returns (uint256 totalGas) {
        console.log("%s⛽ BATCH GAS ESTIMATION: %s%s", CYAN, operation, RESET);
        
        for (uint256 i = 0; i < functions.length; i++) {
            uint256 gasBefore = gasleft();
            functions[i]();
            uint256 gasAfter = gasleft();
            uint256 gasUsed = gasBefore - gasAfter;
            totalGas += gasUsed;
            
            console.log("  [%d] Gas: %d", i, gasUsed);
        }
        
        console.log("  Total Gas: %d", totalGas);
        console.log("  Total Cost: %s ETH", _toETH(totalGas * tx.gasprice));
        
        return totalGas;
    }
    
    // Helper functions
    function _toETH(uint256 weiAmount) private pure returns (string memory) {
        if (weiAmount == 0) return "0";
        
        if (weiAmount < 1e15) {
            return string(abi.encodePacked(_formatNumber(weiAmount), " wei"));
        } else if (weiAmount < 1e18) {
            return string(abi.encodePacked(_formatNumber(weiAmount / 1e15), " finney"));
        } else {
            return string(abi.encodePacked(_formatNumber(weiAmount / 1e18), " ETH"));
        }
    }
    
    function _toUSD(uint256 value) private pure returns (string memory) {
        // Simple conversion - in production, use oracle
        uint256 usdValue = value * 2000 / 1e18; // Assuming $2000/ETH
        return _formatNumber(usdValue);
    }
    
    function _formatAmount(uint256 amount, address token) private view returns (string memory) {
        uint256 decimals = _getTokenDecimals(token);
        uint256 displayAmount = amount / (10 ** (decimals > 18 ? 18 : decimals));
        
        return string(abi.encodePacked(
            _formatNumber(displayAmount),
            " ",
            _getTokenSymbol(token)
        ));
    }
    
    function _formatNumber(uint256 number) private pure returns (string memory) {
        if (number == 0) return "0";
        
        // Format with commas
        bytes memory numStr = abi.encodePacked(_uint2str(number));
        bytes memory result = new bytes(numStr.length + (numStr.length - 1) / 3);
        
        uint256 j = 0;
        for (uint256 i = 0; i < numStr.length; i++) {
            if (i > 0 && (numStr.length - i) % 3 == 0) {
                result[j++] = ",";
            }
            result[j++] = numStr[i];
        }
        
        return string(result);
    }
    
    function _formatPercentage(uint256 value) private pure returns (string memory) {
        return string(abi.encodePacked(
            _formatNumber(value / 100),
            ".",
            _uint2str(value % 100)
        ));
    }
    
    function _formatTimestamp(uint256 timestamp) private view returns (string memory) {
        if (timestamp == 0) return "Never";
        
        uint256 secondsAgo = block.timestamp - timestamp;
        if (secondsAgo < 60) return string(abi.encodePacked(_uint2str(secondsAgo), "s ago"));
        if (secondsAgo < 3600) return string(abi.encodePacked(_uint2str(secondsAgo / 60), "m ago"));
        if (secondsAgo < 86400) return string(abi.encodePacked(_uint2str(secondsAgo / 3600), "h ago"));
        return string(abi.encodePacked(_uint2str(secondsAgo / 86400), "d ago"));
    }
    
    function _formatTime(uint256 seconds_) private pure returns (string memory) {
        if (seconds_ < 60) return string(abi.encodePacked(_uint2str(seconds_), "s"));
        if (seconds_ < 3600) return string(abi.encodePacked(_uint2str(seconds_ / 60), "m ", _uint2str(seconds_ % 60), "s"));
        if (seconds_ < 86400) return string(abi.encodePacked(_uint2str(seconds_ / 3600), "h ", _uint2str((seconds_ % 3600) / 60), "m"));
        return string(abi.encodePacked(_uint2str(seconds_ / 86400), "d ", _uint2str((seconds_ % 86400) / 3600), "h"));
    }
    
    function _getTokenSymbol(address token) private view returns (string memory) {
        if (token == address(0)) return "ETH";
        
        // Try to get symbol from ERC20
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("symbol()")
        );
        
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        
        return "UNKNOWN";
    }
    
    function _getTokenDecimals(address token) private view returns (uint256) {
        if (token == address(0)) return 18;
        
        // Try to get decimals from ERC20
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        
        if (success && data.length > 0) {
            return abi.decode(data, (uint256));
        }
        
        return 18;
    }
    
    function _getTokenPrice(address token) private pure returns (uint256) {
        // Mock prices - in production, use oracle
        if (token == address(0)) return 2000 * 1e18; // $2000/ETH
        return 1 * 1e18; // $1 for stablecoins
    }
    
    function _getChainName(uint256 chainId) private pure returns (string memory) {
        if (chainId == 1) return "Ethereum Mainnet";
        if (chainId == 137) return "Polygon";
        if (chainId == 56) return "Binance Smart Chain";
        if (chainId == 42161) return "Arbitrum";
        if (chainId == 10) return "Optimism";
        if (chainId == 43114) return "Avalanche";
        return string(abi.encodePacked("Chain ", _uint2str(chainId)));
    }
    
    function _calculatePriceImpact(
        LiquidityPool pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) private view returns (uint256) {
        try pool.getSpotPrice(tokenIn, tokenOut) returns (uint256 spotPrice) {
            uint256 expectedOut = amountIn * 1e18 / spotPrice;
            if (expectedOut > amountOut) {
                return (expectedOut - amountOut) * 10000 / expectedOut;
            }
            return 0;
        } catch {
            return 0;
        }
    }
    
    function _bytes32ToString(bytes32 _bytes32) private pure returns (string memory) {
        bytes memory bytesArray = new bytes(32);
        for (uint256 i = 0; i < 32; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
    
    function _bytesToHex(bytes memory buffer) private pure returns (string memory) {
        bytes memory hexTable = "0123456789abcdef";
        bytes memory hexBuffer = new bytes(buffer.length * 2);
        
        for (uint256 i = 0; i < buffer.length; i++) {
            hexBuffer[i * 2] = hexTable[uint8(buffer[i] >> 4)];
            hexBuffer[i * 2 + 1] = hexTable[uint8(buffer[i] & 0x0f)];
        }
        
        return string(abi.encodePacked("0x", hexBuffer));
    }
    
    function _uint2str(uint256 _i) private pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = uint8(48 + _i % 10);
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
