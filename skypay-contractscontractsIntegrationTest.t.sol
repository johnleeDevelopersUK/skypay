// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../../contracts/SkyPayVault.sol";
import "../../contracts/SkyPayRouter.sol";
import "../../contracts/SkyPayWallet.sol";
import "../../contracts/ComplianceModule.sol";
import "../../contracts/LiquidityPool.sol";
import "../../contracts/BridgeAdapter.sol";
import "../../contracts/MockERC20.sol";

contract IntegrationTest is Test {
    SkyPayVault vault;
    SkyPayRouter router;
    SkyPayWallet wallet;
    ComplianceModule compliance;
    LiquidityPool liquidityPool;
    BridgeAdapter bridge;
    
    MockERC20 usdc;
    MockERC20 usdt;
    MockERC20 dai;
    
    address admin = makeAddr("admin");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address feeCollector = makeAddr("feeCollector");
    address guardian = makeAddr("guardian");
    address oracle = makeAddr("oracle");
    
    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usdt = new MockERC20("Tether USD", "USDT", 6);
        dai = new MockERC20("DAI Stablecoin", "DAI", 18);
        
        // Mint tokens to users
        usdc.mint(user1, 100000e6);
        usdt.mint(user1, 100000e6);
        dai.mint(user1, 100000e18);
        
        usdc.mint(user2, 100000e6);
        usdt.mint(user2, 100000e6);
        dai.mint(user2, 100000e18);
        
        // Deploy compliance module
        compliance = new ComplianceModule(admin);
        
        // Deploy vault
        vault = new SkyPayVault(admin, feeCollector);
        
        // Deploy router
        router = new SkyPayRouter(admin, address(vault), address(compliance));
        
        // Deploy liquidity pool
        liquidityPool = new LiquidityPool(admin, feeCollector, oracle);
        
        // Deploy bridge adapter
        bridge = new BridgeAdapter(admin, feeCollector, guardian);
        
        // Initialize contracts
        vault.addRouter(address(router));
        
        // Add tokens to vault
        vault.addToken(address(usdc), address(0), 100, 50); // 1% performance fee, 0.5% withdrawal fee
        vault.addToken(address(usdt), address(0), 100, 50);
        vault.addToken(address(dai), address(0), 100, 50);
        
        // Add tokens to liquidity pool
        liquidityPool.addToken(address(usdc), 10000e6);
        liquidityPool.addToken(address(usdt), 10000e6);
        liquidityPool.addToken(address(dai), 10000e18);
        
        // Add supported chains to bridge
        bridge.addSupportedChain(1); // Ethereum
        bridge.addSupportedChain(137); // Polygon
        
        vm.stopPrank();
    }
    
    function testCompleteFlow() public {
        // User1 deposits USDC to vault
        vm.startPrank(user1);
        usdc.approve(address(vault), 1000e6);
        uint256 shares = vault.deposit(address(usdc), 1000e6);
        assertGt(shares, 0);
        
        // User1 swaps USDT to DAI via router
        usdt.approve(address(router), 500e6);
        SkyPayRouter.SwapParams memory params = SkyPayRouter.SwapParams({
            tokenIn: address(usdt),
            tokenOut: address(dai),
            amountIn: 500e6,
            amountOutMin: 490e18, // 2% slippage
            recipient: user1,
            deadline: block.timestamp + 1 hours,
            routeData: ""
        });
        uint256 amountOut = router.swap(params);
        assertGt(amountOut, 0);
        
        // User1 adds liquidity to pool
        dai.approve(address(liquidityPool), 100e18);
        uint256 poolShares = liquidityPool.addLiquidity(address(dai), 100e18);
        assertGt(poolShares, 0);
        
        // User1 bridges USDC to Polygon
        usdc.approve(address(bridge), 100e6);
        bytes32 bridgeId = bridge.bridgeTokens(
            address(usdc),
            100e6,
            137, // Polygon
            user1
        );
        assertNotEq(bridgeId, bytes32(0));
        
        vm.stopPrank();
    }
    
    function testComplianceIntegration() public {
        // Add user2 to sanction list
        vm.prank(admin);
        compliance.addSanction(user2, "Test sanction");
        
        // Try to transfer from user1 to user2 via vault (should fail)
        vm.startPrank(user1);
        usdc.approve(address(vault), 100e6);
        
        vm.expectRevert(abi.encodeWithSignature("SanctionedAddress()"));
        vault.depositFor(address(usdc), 100e6, user2);
        
        vm.stopPrank();
    }
    
    function testRouterVaultIntegration() public {
        // User1 deposits via router
        vm.startPrank(user1);
        usdc.approve(address(router), 1000e6);
        
        SkyPayRouter.SwapParams memory params = SkyPayRouter.SwapParams({
            tokenIn: address(usdc),
            tokenOut: address(usdc), // Same token for deposit
            amountIn: 1000e6,
            amountOutMin: 990e6, // 1% slippage
            recipient: address(vault), // Deposit directly to vault
            deadline: block.timestamp + 1 hours,
            routeData: abi.encode(true) // Flag for deposit
        });
        
        uint256 shares = router.swapAndDeposit(params, address(vault));
        assertGt(shares, 0);
        
        // Check vault balance
        (uint256 amount, ) = vault.getUserBalance(user1, address(usdc));
        assertEq(amount, 1000e6);
        
        vm.stopPrank();
    }
    
    function testEmergencyProcedures() public {
        // Activate emergency mode on vault
        vm.prank(admin);
        vault.setEmergencyMode(true);
        
        // Try to deposit (should fail)
        vm.startPrank(user1);
        usdc.approve(address(vault), 100e6);
        
        vm.expectRevert(abi.encodeWithSignature("EmergencyModeActive()"));
        vault.deposit(address(usdc), 100e6);
        
        vm.stopPrank();
        
        // Deactivate emergency mode
        vm.prank(admin);
        vault.setEmergencyMode(false);
        
        // Deposit should work now
        vm.startPrank(user1);
        uint256 shares = vault.deposit(address(usdc), 100e6);
        assertGt(shares, 0);
        
        vm.stopPrank();
    }
    
    function testBridgeRelayIntegration() public {
        // Simulate bridge completion from relayer
        vm.startPrank(user1);
        usdc.approve(address(bridge), 100e6);
        bytes32 bridgeId = bridge.bridgeTokens(
            address(usdc),
            100e6,
            137, // Polygon
            user1
        );
        vm.stopPrank();
        
        // Relayer completes bridge on destination chain
        // Note: In real test, this would be on a different chain
        // For this test, we'll simulate the completion
        address relayer = makeAddr("relayer");
        vm.prank(admin);
        bridge.addRelayer(relayer);
        
        vm.prank(relayer);
        bool success = bridge.completeBridge(
            bridgeId,
            address(usdc),
            user1,
            100e6,
            1, // Source chain (Ethereum)
            keccak256("sourceTxHash")
        );
        
        assertTrue(success);
    }
    
    function testFeeCollection() public {
        // Multiple users perform operations
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = makeAddr("user3");
        
        // Distribute tokens
        for (uint256 i = 0; i < users.length; i++) {
            usdc.mint(users[i], 10000e6);
            usdt.mint(users[i], 10000e6);
        }
        
        // Perform operations to generate fees
        for (uint256 i = 0; i < users.length; i++) {
            vm.startPrank(users[i]);
            
            // Deposit to vault
            usdc.approve(address(vault), 1000e6);
            vault.deposit(address(usdc), 1000e6);
            
            // Swap tokens
            usdt.approve(address(router), 500e6);
            SkyPayRouter.SwapParams memory params = SkyPayRouter.SwapParams({
                tokenIn: address(usdt),
                tokenOut: address(usdc),
                amountIn: 500e6,
                amountOutMin: 490e6,
                recipient: users[i],
                deadline: block.timestamp + 1 hours,
                routeData: ""
            });
            router.swap(params);
            
            // Add liquidity
            usdc.approve(address(liquidityPool), 100e6);
            liquidityPool.addLiquidity(address(usdc), 100e6);
            
            vm.stopPrank();
        }
        
        // Collect fees from all contracts
        vm.startPrank(admin);
        
        // Collect vault fees
        vault.collectFees(address(usdc));
        vault.collectFees(address(usdt));
        
        // Collect liquidity pool fees
        liquidityPool.collectFees(address(usdc));
        liquidityPool.collectFees(address(usdt));
        
        // Collect bridge fees
        bridge.collectFees(address(usdc));
        
        vm.stopPrank();
        
        // Verify fee collector received fees
        // (In production, you would check balances)
    }
}
