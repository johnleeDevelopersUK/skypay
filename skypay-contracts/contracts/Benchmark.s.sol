// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/ConsoleUtils.sol";
import "../../contracts/SkyPayVault.sol";
import "../../contracts/SkyPayRouter.sol";
import "../../contracts/ComplianceModule.sol";

contract Benchmark is Script, ConsoleUtils {
    SkyPayVault public vault;
    SkyPayRouter public router;
    ComplianceModule public compliance;
    
    MockERC20 public usdc;
    MockERC20 public usdt;
    
    address public admin = address(0x1234);
    address public user = address(0x5678);
    address public feeCollector = address(0xFEE);
    
    function run() public {
        console.log("%s📊 SKYPAY PERFORMANCE BENCHMARK%s", GREEN, RESET);
        console.log("%s========================================%s", BLUE, RESET);
        
        // Set up
        deployContracts();
        
        // Run benchmarks
        benchmarkVaultDepositWithdraw();
        benchmarkRouterSwap();
        benchmarkComplianceChecks();
        benchmarkBatchOperations();
        
        console.log("\n%s✅ BENCHMARK COMPLETE%s", GREEN, RESET);
    }
    
    function deployContracts() internal {
        console.log("Deploying contracts for benchmark...");
        
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usdt = new MockERC20("Tether USD", "USDT", 6);
        
        usdc.mint(user, 1000000e6);
        usdt.mint(user, 1000000e6);
        
        compliance = new ComplianceModule(admin);
        vault = new SkyPayVault(admin, feeCollector);
        router = new SkyPayRouter(admin, address(vault), address(compliance));
        
        vault.addRouter(address(router));
        vault.addToken(address(usdc), address(0), 100, 50);
        vault.addToken(address(usdt), address(0), 100, 50);
    }
    
    function benchmarkVaultDepositWithdraw() internal {
        console.log("\n%s💰 VAULT DEPOSIT/WITHDRAW BENCHMARK%s", YELLOW, RESET);
        
        vm.startPrank(user);
        usdc.approve(address(vault), type(uint256).max);
        
        // Single deposit
        uint256 gas1 = estimateAndLogGas("Single Deposit", this._singleDeposit);
        
        // Batch deposits (10)
        uint256 gas10 = estimateAndLogGas("10x Batch Deposit", this._batchDeposit10);
        
        // Efficiency gain
        uint256 efficiency = (gas1 * 10 - gas10) * 100 / (gas1 * 10);
        console.log("\nBatch Efficiency: %s%% gas saved", _formatNumber(efficiency));
        
        vm.stopPrank();
    }
    
    function _singleDeposit() external {
        vault.deposit(address(usdc), 100e6);
    }
    
    function _batchDeposit10() external {
        for (uint256 i = 0; i < 10; i++) {
            vault.deposit(address(usdc), 10e6);
        }
    }
    
    function benchmarkRouterSwap() internal {
        console.log("\n%s🔄 ROUTER SWAP BENCHMARK%s", MAGENTA, RESET);
        
        vm.startPrank(user);
        usdt.approve(address(router), type(uint256).max);
        
        SkyPayRouter.SwapParams memory params = SkyPayRouter.SwapParams({
            tokenIn: address(usdt),
            tokenOut: address(usdc),
            amountIn: 100e6,
            amountOutMin: 99e6,
            recipient: user,
            deadline: block.timestamp + 1 hours,
            routeData: ""
        });
        
        // Single swap
        uint256 gas = estimateAndLogGas("Single Swap", 
            abi.encodeWithSelector(this._executeSwap.selector, params));
        
        // With compliance check
        vm.prank(admin);
        compliance.addSanction(address(0x9999), "Test sanction");
        
        params.recipient = address(0x9999);
        uint256 gasWithCompliance = estimateAndLogGas("Swap with Compliance Check",
            abi.encodeWithSelector(this._executeSwap.selector, params));
        
        console.log("\nCompliance Overhead: %d gas (%s%%)",
            gasWithCompliance - gas,
            _formatNumber((gasWithCompliance - gas) * 100 / gas));
        
        vm.stopPrank();
    }
    
    function _executeSwap(SkyPayRouter.SwapParams memory params) external {
        router.swap(params);
    }
    
    function benchmarkComplianceChecks() internal {
        console.log("\n%s🛡️ COMPLIANCE CHECK BENCHMARK%s", RED, RESET);
        
        // Single check
        uint256 gas1 = estimateAndLogGas("Single Compliance Check",
            this._singleComplianceCheck);
        
        // Batch checks (100)
        uint256 gas100 = estimateAndLogGas("100x Batch Compliance Check",
            this._batchComplianceCheck100);
        
        // Per-check average
        console.log("\nAverage per check: %d gas", gas100 / 100);
        console.log("Batch efficiency: %s%%", 
            _formatNumber((gas1 * 100 - gas100) * 100 / (gas1 * 100)));
    }
    
    function _singleComplianceCheck() external {
        compliance.assessTransaction(user, address(0x1111), 100e6, address(usdc));
    }
    
    function _batchComplianceCheck100() external {
        for (uint256 i = 0; i < 100; i++) {
            compliance.assessTransaction(
                address(uint160(i)),
                address(uint160(i + 1)),
                100e6,
                address(usdc)
            );
        }
    }
    
    function benchmarkBatchOperations() internal {
        console.log("\n%s⚡ BATCH OPERATIONS BENCHMARK%s", CYAN, RESET);
        
        vm.startPrank(user);
        usdc.approve(address(vault), type(uint256).max);
        usdt.approve(address(router), type(uint256).max);
        
        // Multiple operations in sequence
        function() external[] memory ops = new function() external[](4);
        ops[0] = this._op1;
        ops[1] = this._op2;
        ops[2] = this._op3;
        ops[3] = this._op4;
        
        uint256 totalGas = estimateBatchGas("Multi-Operation Sequence", ops);
        
        // Compare with individual calls
        uint256 individualGas = 0;
        individualGas += estimateAndLogGas("Operation 1", ops[0]);
        individualGas += estimateAndLogGas("Operation 2", ops[1]);
        individualGas += estimateAndLogGas("Operation 3", ops[2]);
        individualGas += estimateAndLogGas("Operation 4", ops[3]);
        
        console.log("\nBatch vs Individual:");
        console.log("  Individual: %d gas", individualGas);
        console.log("  Batch: %d gas", totalGas);
        console.log("  Savings: %d gas (%s%%)",
            individualGas - totalGas,
            _formatNumber((individualGas - totalGas) * 100 / individualGas));
        
        vm.stopPrank();
    }
    
    function _op1() external {
        vault.deposit(address(usdc), 100e6);
    }
    
    function _op2() external {
        SkyPayRouter.SwapParams memory params = SkyPayRouter.SwapParams({
            tokenIn: address(usdc),
            tokenOut: address(usdt),
            amountIn: 50e6,
            amountOutMin: 49e6,
            recipient: user,
            deadline: block.timestamp + 1 hours,
            routeData: ""
        });
        router.swap(params);
    }
    
    function _op3() external {
        vault.withdraw(address(usdc), 25e6);
    }
    
    function _op4() external {
        // Another swap
        SkyPayRouter.SwapParams memory params = SkyPayRouter.SwapParams({
            tokenIn: address(usdt),
            tokenOut: address(usdc),
            amountIn: 25e6,
            amountOutMin: 24e6,
            recipient: user,
            deadline: block.timestamp + 1 hours,
            routeData: ""
        });
        router.swap(params);
    }
}
