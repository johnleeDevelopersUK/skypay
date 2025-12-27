// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../../contracts/SkyPayVault.sol";
import "../../contracts/SkyPayRouter.sol";
import "../../contracts/SkyPayWallet.sol";
import "../../contracts/SkyPayRelayer.sol";
import "../../contracts/ComplianceModule.sol";
import "../../contracts/LiquidityPool.sol";
import "../../contracts/BridgeAdapter.sol";
import "../../contracts/SkyPayGovernor.sol";
import "../../contracts/TimelockController.sol";

contract DeployAll is Script {
    address public admin = vm.envAddress("ADMIN_ADDRESS");
    address public feeCollector = vm.envAddress("FEE_COLLECTOR");
    address public guardian = vm.envAddress("GUARDIAN_ADDRESS");
    
    SkyPayVault public vault;
    SkyPayRouter public router;
    SkyPayWallet public walletImplementation;
    SkyPayRelayer public relayer;
    ComplianceModule public compliance;
    LiquidityPool public liquidityPool;
    BridgeAdapter public bridge;
    TimelockController public timelock;
    SkyPayGovernor public governor;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Starting deployment of SkyPay ecosystem...");
        console.log("Admin:", admin);
        console.log("Fee Collector:", feeCollector);
        console.log("Guardian:", guardian);
        
        // 1. Deploy Timelock Controller
        console.log("\n1. Deploying TimelockController...");
        address[] memory proposers = new address[](1);
        proposers[0] = admin;
        address[] memory executors = new address[](1);
        executors[0] = admin;
        timelock = new TimelockController(2 days, proposers, executors, admin);
        console.log("TimelockController deployed at:", address(timelock));
        
        // 2. Deploy Governance Token (using OpenZeppelin's ERC20Votes)
        console.log("\n2. Deploying Governance Token...");
        // Note: In production, you would deploy your own ERC20Votes token
        // For this script, we'll assume it's already deployed
        address governanceToken = vm.envAddress("GOVERNANCE_TOKEN");
        console.log("Governance Token:", governanceToken);
        
        // 3. Deploy Governor
        console.log("\n3. Deploying SkyPayGovernor...");
        governor = new SkyPayGovernor(
            ERC20Votes(governanceToken),
            timelock,
            1, // voting delay: 1 block
            50400, // voting period: 1 week (assuming 15s blocks)
            1000e18, // proposal threshold: 1000 tokens
            4 // quorum percentage: 4%
        );
        console.log("SkyPayGovernor deployed at:", address(governor));
        
        // 4. Deploy Compliance Module
        console.log("\n4. Deploying ComplianceModule...");
        compliance = new ComplianceModule(admin);
        console.log("ComplianceModule deployed at:", address(compliance));
        
        // 5. Deploy Vault
        console.log("\n5. Deploying SkyPayVault...");
        vault = new SkyPayVault(admin, feeCollector);
        console.log("SkyPayVault deployed at:", address(vault));
        
        // 6. Deploy Router
        console.log("\n6. Deploying SkyPayRouter...");
        router = new SkyPayRouter(admin, address(vault), address(compliance));
        console.log("SkyPayRouter deployed at:", address(router));
        
        // 7. Deploy Wallet Implementation
        console.log("\n7. Deploying SkyPayWallet implementation...");
        walletImplementation = new SkyPayWallet();
        console.log("SkyPayWallet implementation deployed at:", address(walletImplementation));
        
        // 8. Deploy Relayer
        console.log("\n8. Deploying SkyPayRelayer...");
        relayer = new SkyPayRelayer(admin, feeCollector);
        console.log("SkyPayRelayer deployed at:", address(relayer));
        
        // 9. Deploy Liquidity Pool
        console.log("\n9. Deploying LiquidityPool...");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        liquidityPool = new LiquidityPool(admin, feeCollector, oracle);
        console.log("LiquidityPool deployed at:", address(liquidityPool));
        
        // 10. Deploy Bridge Adapter
        console.log("\n10. Deploying BridgeAdapter...");
        bridge = new BridgeAdapter(admin, feeCollector, guardian);
        console.log("BridgeAdapter deployed at:", address(bridge));
        
        // 11. Initialize contracts
        console.log("\n11. Initializing contracts...");
        
        // Add router to vault
        vault.addRouter(address(router));
        console.log("Router added to vault");
        
        // Add supported chains to bridge
        bridge.addSupportedChain(1); // Ethereum
        bridge.addSupportedChain(137); // Polygon
        bridge.addSupportedChain(56); // BSC
        console.log("Supported chains added to bridge");
        
        // Set bridge limits
        bridge.setChainLimits(1, 0.01 ether, 1000 ether);
        bridge.setChainLimits(137, 0.01 ether, 1000 ether);
        bridge.setChainLimits(56, 0.01 ether, 1000 ether);
        console.log("Bridge limits set");
        
        // Add relayer to router
        router.addRelayer(address(relayer));
        console.log("Relayer added to router");
        
        // Set up fee structures
        relayer.setFeeStructure(0.001 ether, 100);
        console.log("Relayer fee structure set");
        
        liquidityPool.setSwapFee(30); // 0.3%
        liquidityPool.setMaxSlippage(500); // 5%
        console.log("Liquidity pool parameters set");
        
        // 12. Transfer ownership to timelock
        console.log("\n12. Transferring ownership to timelock...");
        
        // Grant timelock admin roles
        vault.grantRole(vault.DEFAULT_ADMIN_ROLE(), address(timelock));
        vault.grantRole(vault.ADMIN_ROLE(), address(timelock));
        vault.revokeRole(vault.DEFAULT_ADMIN_ROLE(), admin);
        vault.revokeRole(vault.ADMIN_ROLE(), admin);
        console.log("Vault ownership transferred");
        
        router.grantRole(router.DEFAULT_ADMIN_ROLE(), address(timelock));
        router.grantRole(router.ADMIN_ROLE(), address(timelock));
        router.revokeRole(router.DEFAULT_ADMIN_ROLE(), admin);
        router.revokeRole(router.ADMIN_ROLE(), admin);
        console.log("Router ownership transferred");
        
        // Add governor as proposer to timelock
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(governor));
        console.log("Governor added as proposer and executor");
        
        vm.stopBroadcast();
        
        console.log("\n✅ Deployment completed successfully!");
        console.log("\n📋 Contract Addresses:");
        console.log("TimelockController:", address(timelock));
        console.log("SkyPayGovernor:", address(governor));
        console.log("ComplianceModule:", address(compliance));
        console.log("SkyPayVault:", address(vault));
        console.log("SkyPayRouter:", address(router));
        console.log("SkyPayWallet Implementation:", address(walletImplementation));
        console.log("SkyPayRelayer:", address(relayer));
        console.log("LiquidityPool:", address(liquidityPool));
        console.log("BridgeAdapter:", address(bridge));
        
        console.log("\n📝 Next steps:");
        console.log("1. Verify all contracts on block explorer");
        console.log("2. Initialize governance with initial token distribution");
        console.log("3. Set up initial liquidity in pools");
        console.log("4. Deploy and configure frontend");
        console.log("5. Run comprehensive security audit");
    }
}
