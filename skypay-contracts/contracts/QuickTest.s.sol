// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/ConsoleUtils.sol";
import "../../contracts/SkyPayVault.sol";
import "../../contracts/SkyPayRouter.sol";
import "../../contracts/ComplianceModule.sol";
import "../../contracts/LiquidityPool.sol";
import "../../contracts/BridgeAdapter.sol";
import "../../contracts/SkyPayWallet.sol";
import "../../contracts/SkyPayRelayer.sol";
import "../../contracts/SkyPayGovernor.sol";
import "../../contracts/MockERC20.sol";

contract QuickTest is Script, ConsoleUtils {
    SkyPayVault public vault;
    SkyPayRouter public router;
    ComplianceModule public compliance;
    LiquidityPool public pool;
    BridgeAdapter public bridge;
    SkyPayWallet public wallet;
    SkyPayRelayer public relayer;
    SkyPayGovernor public governor;
    
    MockERC20 public usdc;
    MockERC20 public usdt;
    MockERC20 public dai;
    
    address public admin = address(0x1234);
    address public user1 = address(0x5678);
    address public user2 = address(0x9ABC);
    address public feeCollector = address(0xFEE);
    address public guardian = address(0xGUARD);
    address public oracle = address(0xORACLE);
    
    function run() public {
        console.log("%s🚀 SKYPAY QUICK TEST SCRIPT%s", GREEN, RESET);
        console.log("%s========================================%s", BLUE, RESET);
        
        // Set up test environment
        setUpEnvironment();
        
        // Run comprehensive tests
        testVaultOperations();
        testRouterOperations();
        testComplianceOperations();
        testPoolOperations();
        testBridgeOperations();
        testWalletOperations();
        testRelayerOperations();
        
        // Show final dashboard
        showDashboard(
            vault,
            router,
            compliance,
            pool,
            bridge,
            wallet,
            relayer,
            governor
        );
        
        console.log("\n%s✅ ALL TESTS COMPLETED SUCCESSFULLY!%s", GREEN, RESET);
    }
    
    function setUpEnvironment() internal {
        console.log("\n%s🔧 SETTING UP TEST ENVIRONMENT%s", YELLOW, RESET);
        
        // Deploy mock tokens
        console.log("Deploying mock tokens...");
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usdt = new MockERC20("Tether USD", "USDT", 6);
        dai = new MockERC20("DAI Stablecoin", "DAI", 18);
        
        console.log("  USDC: %s", address(usdc));
        console.log("  USDT: %s", address(usdt));
        console.log("  DAI: %s", address(dai));
        
        // Distribute tokens
        usdc.mint(user1, 10000e6);
        usdt.mint(user1, 10000e6);
        dai.mint(user1, 10000e18);
        
        usdc.mint(user2, 10000e6);
        usdt.mint(user2, 10000e6);
        dai.mint(user2, 10000e18);
        
        // Deploy compliance module
        console.log("\nDeploying ComplianceModule...");
        compliance = new ComplianceModule(admin);
        
        // Deploy vault
        console.log("Deploying SkyPayVault...");
        vault = new SkyPayVault(admin, feeCollector);
        
        // Deploy router
        console.log("Deploying SkyPayRouter...");
        router = new SkyPayRouter(admin, address(vault), address(compliance));
        
        // Deploy liquidity pool
        console.log("Deploying LiquidityPool...");
        pool = new LiquidityPool(admin, feeCollector, oracle);
        
        // Deploy bridge adapter
        console.log("Deploying BridgeAdapter...");
        bridge = new BridgeAdapter(admin, feeCollector, guardian);
        
        // Deploy wallet implementation
        console.log("Deploying SkyPayWallet...");
        wallet = new SkyPayWallet();
        
        // Deploy relayer
        console.log("Deploying SkyPayRelayer...");
        relayer = new SkyPayRelayer(admin, feeCollector);
        
        // Initialize contracts
        console.log("\n%s⚙️ INITIALIZING CONTRACTS%s", YELLOW, RESET);
        
        // Add router to vault
        vault.addRouter(address(router));
        console.log("  Router added to vault");
        
        // Add tokens to vault
        vault.addToken(address(usdc), address(0), 100, 50);
        vault.addToken(address(usdt), address(0), 100, 50);
        vault.addToken(address(dai), address(0), 100, 50);
        console.log("  Tokens added to vault");
        
        // Add tokens to liquidity pool
        pool.addToken(address(usdc), 1000e6);
        pool.addToken(address(usdt), 1000e6);
        pool.addToken(address(dai), 1000e18);
        console.log("  Tokens added to liquidity pool");
        
        // Add supported chains to bridge
        bridge.addSupportedChain(1); // Ethereum
        bridge.addSupportedChain(137); // Polygon
        console.log("  Chains added to bridge");
        
        // Set bridge limits
        bridge.setChainLimits(1, 0.01 ether, 1000 ether);
        bridge.setChainLimits(137, 0.01 ether, 1000 ether);
        console.log("  Bridge limits set");
        
        // Add relayer to router
        router.addRelayer(address(relayer));
        console.log("  Relayer added to router");
        
        console.log("%s✅ ENVIRONMENT SETUP COMPLETE%s", GREEN, RESET);
    }
    
    function testVaultOperations() internal {
        console.log("\n%s💰 TESTING VAULT OPERATIONS%s", BLUE, RESET);
        
        // Show initial state
        logVaultState(vault);
        
        // User1 deposits to vault
        console.log("\n%s[TEST] User1 deposits 1000 USDC to vault%s", CYAN, RESET);
        vm.startPrank(user1);
        usdc.approve(address(vault), 1000e6);
        uint256 shares = vault.deposit(address(usdc), 1000e6);
        console.log("  Shares received: %s", _formatNumber(shares));
        vm.stopPrank();
        
        // Show user position
        logVaultUserPosition(vault, user1);
        
        // User2 deposits to vault
        console.log("\n%s[TEST] User2 deposits 500 USDT to vault%s", CYAN, RESET);
        vm.startPrank(user2);
        usdt.approve(address(vault), 500e6);
        shares = vault.deposit(address(usdt), 500e6);
        console.log("  Shares received: %s", _formatNumber(shares));
        vm.stopPrank();
        
        // Show final vault state
        logVaultState(vault);
    }
    
    function testRouterOperations() internal {
        console.log("\n%s🔄 TESTING ROUTER OPERATIONS%s", MAGENTA, RESET);
        
        // Show router state
        logRouterState(router);
        
        // Calculate swap
        console.log("\n%s[TEST] Calculate USDT to DAI swap%s", CYAN, RESET);
        calculateAndLogSwap(router, address(usdt), address(dai), 100e6);
        
        // Execute swap (user1)
        console.log("\n%s[TEST] User1 swaps 100 USDT to DAI%s", CYAN, RESET);
        vm.startPrank(user1);
        usdt.approve(address(router), 100e6);
        
        SkyPayRouter.SwapParams memory params = SkyPayRouter.SwapParams({
            tokenIn: address(usdt),
            tokenOut: address(dai),
            amountIn: 100e6,
            amountOutMin: 95e18, // 5% slippage tolerance
            recipient: user1,
            deadline: block.timestamp + 1 hours,
            routeData: ""
        });
        
        uint256 amountOut = router.swap(params);
        console.log("  Amount received: %s", _formatAmount(amountOut, address(dai)));
        vm.stopPrank();
    }
    
    function testComplianceOperations() internal {
        console.log("\n%s🛡️ TESTING COMPLIANCE OPERATIONS%s", RED, RESET);
        
        // Show compliance state
        logComplianceState(compliance);
        
        // Add user2 to sanction list
        console.log("\n%s[TEST] Add user2 to sanctions list%s", CYAN, RESET);
        vm.prank(admin);
        compliance.addSanction(user2, "Test sanction for compliance testing");
        console.log("  User2 added to sanctions");
        
        // Test transaction assessment
        console.log("\n%s[TEST] Assess transaction from user1 to user2%s", CYAN, RESET);
        assessTransactionCompliance(
            compliance,
            user1,
            user2,
            100e6,
            address(usdc)
        );
        
        // Test whitelisting
        console.log("\n%s[TEST] Whitelist user2%s", CYAN, RESET);
        vm.prank(admin);
        compliance.whitelistAddress(user2);
        console.log("  User2 whitelisted");
        
        // Re-assess transaction
        console.log("\n%s[TEST] Re-assess transaction after whitelisting%s", CYAN, RESET);
        assessTransactionCompliance(
            compliance,
            user1,
            user2,
            100e6,
            address(usdc)
        );
    }
    
    function testPoolOperations() internal {
        console.log("\n%s💧 TESTING LIQUIDITY POOL OPERATIONS%s", GREEN, RESET);
        
        // Show pool state
        logLiquidityPoolState(pool);
        
        // Calculate swap
        console.log("\n%s[TEST] Calculate USDC to USDT swap in pool%s", CYAN, RESET);
        calculateAndLogPoolSwap(pool, address(usdc), address(usdt), 100e6);
        
        // User1 adds liquidity
        console.log("\n%s[TEST] User1 adds 100 USDC liquidity%s", CYAN, RESET);
        vm.startPrank(user1);
        usdc.approve(address(pool), 100e6);
        uint256 shares = pool.addLiquidity(address(usdc), 100e6);
        console.log("  Shares received: %s", _formatNumber(shares));
        vm.stopPrank();
        
        // User1 swaps in pool
        console.log("\n%s[TEST] User1 swaps 50 USDC to USDT in pool%s", CYAN, RESET);
        vm.startPrank(user1);
        usdc.approve(address(pool), 50e6);
        uint256 amountOut = pool.swap(address(usdc), address(usdt), 50e6, 48e6);
        console.log("  Amount received: %s", _formatAmount(amountOut, address(usdt)));
        vm.stopPrank();
        
        // Show updated pool state
        logLiquidityPoolState(pool);
    }
    
    function testBridgeOperations() internal {
        console.log("\n%s🌉 TESTING BRIDGE OPERATIONS%s", CYAN, RESET);
        
        // Show bridge state
        logBridgeState(bridge);
        
        // Calculate bridge fee
        console.log("\n%s[TEST] Calculate bridge fee for 100 USDC to Polygon%s", CYAN, RESET);
        calculateAndLogBridgeFee(bridge, address(usdc), 100e6, 137);
        
        // User1 bridges tokens
        console.log("\n%s[TEST] User1 bridges 100 USDC to Polygon%s", CYAN, RESET);
        vm.startPrank(user1);
        usdc.approve(address(bridge), 100e6);
        bytes32 bridgeId = bridge.bridgeTokens(
            address(usdc),
            100e6,
            137, // Polygon
            user1
        );
        console.log("  Bridge ID: %s", _bytes32ToString(bridgeId));
        vm.stopPrank();
        
        // Check bridge status
        console.log("\n%s[TEST] Check bridge status%s", CYAN, RESET);
        IBridgeAdapter.BridgeStatus memory status = bridge.getBridgeStatus(bridgeId);
        console.log("  State: %s", _bridgeStateToString(status.state));
        console.log("  Timestamp: %s", _formatTimestamp(status.timestamp));
    }
    
    function testWalletOperations() internal {
        console.log("\n%s👛 TESTING WALLET OPERATIONS%s", BLUE, RESET);
        
        // Show wallet state
        logWalletState(wallet);
        
        // Add guardians
        console.log("\n%s[TEST] Add guardians to wallet%s", CYAN, RESET);
        address[] memory guardians = new address[](2);
        guardians[0] = user1;
        guardians[1] = user2;
        
        vm.prank(admin);
        wallet.addGuardians(guardians);
        console.log("  Guardians added: %s, %s", user1, user2);
        
        // Set daily limit
        console.log("\n%s[TEST] Set daily limit to 10 ETH%s", CYAN, RESET);
        vm.prank(admin);
        wallet.setDailyLimit(10 ether);
        console.log("  Daily limit set");
        
        // Show updated wallet state
        logWalletState(wallet);
    }
    
    function testRelayerOperations() internal {
        console.log("\n%s⚡ TESTING RELAYER OPERATIONS%s", MAGENTA, RESET);
        
        // Show relayer state
        logRelayerState(relayer);
        
        // Add relayer
        console.log("\n%s[TEST] Add user1 as relayer%s", CYAN, RESET);
        vm.prank(admin);
        relayer.addRelayer(user1);
        console.log("  User1 added as relayer");
        
        // User1 deposits gas
        console.log("\n%s[TEST] User1 deposits 1 ETH for gas%s", CYAN, RESET);
        vm.deal(user1, 1 ether);
        vm.startPrank(user1);
        relayer.depositGas{value: 0.5 ether}(address(0), 0.5 ether);
        console.log("  0.5 ETH deposited for gas");
        vm.stopPrank();
        
        // Show updated relayer state
        logRelayerState(relayer);
    }
    
    // Helper functions
    function _bridgeStateToString(IBridgeAdapter.BridgeState state) 
        internal 
        pure 
        returns (string memory) 
    {
        if (state == IBridgeAdapter.BridgeState.PENDING) return "PENDING";
        if (state == IBridgeAdapter.BridgeState.PROCESSING) return "PROCESSING";
        if (state == IBridgeAdapter.BridgeState.COMPLETED) return "COMPLETED";
        if (state == IBridgeAdapter.BridgeState.FAILED) return "FAILED";
        if (state == IBridgeAdapter.BridgeState.REFUNDED) return "REFUNDED";
        return "UNKNOWN";
    }
}
