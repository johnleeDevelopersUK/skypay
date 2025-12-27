// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../contracts/MockERC20.sol";

/**
 * @title MockTokenUtils
 * @dev Utilities for working with mock tokens in tests
 */
library MockTokenUtils {
    // Common stablecoin configurations
    struct TokenConfig {
        string name;
        string symbol;
        uint8 decimals;
        uint256 initialSupply;
        address initialHolder;
    }
    
    // Pre-configured stablecoins
    TokenConfig constant USDC_CONFIG = TokenConfig({
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        initialSupply: 1_000_000_000 * 10**6, // 1B USDC
        initialHolder: address(0x1000)
    });
    
    TokenConfig constant USDT_CONFIG = TokenConfig({
        name: "Tether USD",
        symbol: "USDT",
        decimals: 6,
        initialSupply: 1_000_000_000 * 10**6, // 1B USDT
        initialHolder: address(0x1001)
    });
    
    TokenConfig constant DAI_CONFIG = TokenConfig({
        name: "DAI Stablecoin",
        symbol: "DAI",
        decimals: 18,
        initialSupply: 1_000_000_000 * 10**18, // 1B DAI
        initialHolder: address(0x1002)
    });
    
    TokenConfig constant EURS_CONFIG = TokenConfig({
        name: "EURO StableCOIN",
        symbol: "EURS",
        decimals: 2,
        initialSupply: 1_000_000_000 * 10**2, // 1B EURS
        initialHolder: address(0x1003)
    });
    
    /**
     * @dev Create and configure a USDC mock
     */
    function createUSDC() internal returns (MockERC20) {
        MockERC20 token = new MockERC20(
            USDC_CONFIG.name,
            USDC_CONFIG.symbol,
            USDC_CONFIG.decimals
        );
        token.mint(USDC_CONFIG.initialHolder, USDC_CONFIG.initialSupply);
        return token;
    }
    
    /**
     * @dev Create and configure a USDT mock
     */
    function createUSDT() internal returns (MockERC20) {
        MockERC20 token = new MockERC20(
            USDT_CONFIG.name,
            USDT_CONFIG.symbol,
            USDT_CONFIG.decimals
        );
        token.mint(USDT_CONFIG.initialHolder, USDT_CONFIG.initialSupply);
        return token;
    }
    
    /**
     * @dev Create and configure a DAI mock
     */
    function createDAI() internal returns (MockERC20) {
        MockERC20 token = new MockERC20(
            DAI_CONFIG.name,
            DAI_CONFIG.symbol,
            DAI_CONFIG.decimals
        );
        token.mint(DAI_CONFIG.initialHolder, DAI_CONFIG.initialSupply);
        return token;
    }
    
    /**
     * @dev Create and configure an EURS mock
     */
    function createEURS() internal returns (MockERC20) {
        MockERC20 token = new MockERC20(
            EURS_CONFIG.name,
            EURS_CONFIG.symbol,
            EURS_CONFIG.decimals
        );
        token.mint(EURS_CONFIG.initialHolder, EURS_CONFIG.initialSupply);
        return token;
    }
    
    /**
     * @dev Create all major stablecoins for testing
     */
    function createAllStablecoins() 
        internal 
        returns (
            MockERC20 usdc,
            MockERC20 usdt,
            MockERC20 dai,
            MockERC20 eurs
        ) 
    {
        usdc = createUSDC();
        usdt = createUSDT();
        dai = createDAI();
        eurs = createEURS();
    }
    
    /**
     * @dev Distribute tokens to multiple addresses
     */
    function distributeTokens(
        MockERC20 token,
        address[] memory recipients,
        uint256 amount
    ) internal {
        for (uint256 i = 0; i < recipients.length; i++) {
            token.mint(recipients[i], amount);
        }
    }
    
    /**
     * @dev Approve token spending for multiple spenders
     */
    function approveMultiple(
        MockERC20 token,
        address owner,
        address[] memory spenders,
        uint256 amount
    ) internal {
        for (uint256 i = 0; i < spenders.length; i++) {
            token.approve(spenders[i], amount);
        }
    }
    
    /**
     * @dev Simulate token transfers between addresses
     */
    function simulateTransfers(
        MockERC20 token,
        address[] memory senders,
        address[] memory receivers,
        uint256 amount
    ) internal {
        require(senders.length == receivers.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < senders.length; i++) {
            // Mint to sender if needed
            if (token.balanceOf(senders[i]) < amount) {
                token.mint(senders[i], amount);
            }
            
            // Transfer
            token.transferFrom(senders[i], receivers[i], amount);
        }
    }
    
    /**
     * @dev Create token with specific features for testing
     */
    function createTokenWithFeatures(
        string memory name,
        string memory symbol,
        uint8 decimals,
        bool withTransferFee,
        bool blacklistEnabled,
        bool bridgeable
    ) internal returns (MockERC20) {
        MockERC20 token = new MockERC20(name, symbol, decimals);
        
        if (withTransferFee) {
            token.setTransferFee(10, address(this)); // 0.1% fee
            token.setTransferFeeEnabled(true);
        }
        
        if (blacklistEnabled) {
            // Blacklist some test addresses
            token.setBlacklisted(address(0x9999), true);
            token.setBlacklisted(address(0x8888), true);
        }
        
        if (bridgeable) {
            token.setBridgeable(true, address(this));
        }
        
        return token;
    }
}

/**
 * @title MockTokenUser
 * @dev Contract that can receive and hold tokens for testing
 */
contract MockTokenUser {
    receive() external payable {}
    
    /**
     * @dev Approve token spending
     */
    function approveToken(MockERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }
    
    /**
     * @dev Transfer tokens from this contract
     */
    function transferToken(MockERC20 token, address to, uint256 amount) external {
        token.transfer(to, amount);
    }
    
    /**
     * @dev Transfer tokens from another address (requires approval)
     */
    function transferTokenFrom(
        MockERC20 token,
        address from,
        address to,
        uint256 amount
    ) external {
        token.transferFrom(from, to, amount);
    }
    
    /**
     * @deposit tokens to a contract
     */
    function depositToContract(
        MockERC20 token,
        address contractAddress,
        uint256 amount
    ) external {
        token.transfer(contractAddress, amount);
    }
    
    /**
     * @dev Get token balance
     */
    function getBalance(MockERC20 token) external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}

/**
 * @title MockTokenScenario
 * @dev Pre-configured testing scenarios with mock tokens
 */
contract MockTokenScenario {
    using MockTokenUtils for MockERC20;
    
    MockERC20 public usdc;
    MockERC20 public usdt;
    MockERC20 public dai;
    
    address public admin;
    address public alice;
    address public bob;
    address public charlie;
    address public david;
    
    constructor() {
        admin = msg.sender;
        alice = address(0xA11CE);
        bob = address(0xB0B);
        charlie = address(0xC0C);
        david = address(0xD4V1D);
        
        // Create stablecoins
        (usdc, usdt, dai,) = MockTokenUtils.createAllStablecoins();
    }
    
    /**
     * @dev Setup basic scenario with token distribution
     */
    function setupBasicScenario() external {
        // Distribute tokens
        address[] memory users = new address[](4);
        users[0] = alice;
        users[1] = bob;
        users[2] = charlie;
        users[3] = david;
        
        usdc.distributeTokens(users, 10000e6);
        usdt.distributeTokens(users, 10000e6);
        dai.distributeTokens(users, 10000e18);
    }
    
    /**
     * @dev Setup compliance testing scenario
     */
    function setupComplianceScenario() external {
        setupBasicScenario();
        
        // Blacklist some addresses
        usdc.setBlacklisted(bob, true);
        usdt.setBlacklisted(charlie, true);
        
        // Set transfer fees
        usdc.setTransferFee(50, admin); // 0.5% fee
        usdc.setTransferFeeEnabled(true);
    }
    
    /**
     * @dev Setup bridge testing scenario
     */
    function setupBridgeScenario() external {
        setupBasicScenario();
        
        // Make tokens bridgeable
        usdc.setBridgeable(true, address(this));
        usdt.setBridgeable(true, address(this));
        dai.setBridgeable(true, address(this));
    }
    
    /**
     * @dev Setup complex trading scenario
     */
    function setupTradingScenario() external {
        setupBasicScenario();
        
        // Create token with rebasing
        MockRebasingToken rebasingToken = new MockRebasingToken(
            "Rebasing Token",
            "RBT",
            18,
            500 // 5% annual rebase
        );
        
        // Distribute rebasing token
        address[] memory users = new address[](4);
        users[0] = alice;
        users[1] = bob;
        users[2] = charlie;
        users[3] = david;
        
        for (uint256 i = 0; i < users.length; i++) {
            rebasingToken.mint(users[i], 10000e18);
        }
        
        // Execute a rebase
        rebasingToken.rebase();
    }
    
    /**
     * @dev Simulate token transfers between users
     */
    function simulateTransfers(uint256 rounds) external {
        address[] memory senders = new address[](4);
        address[] memory receivers = new address[](4);
        
        for (uint256 round = 0; round < rounds; round++) {
            // Rotate senders and receivers
            if (round % 4 == 0) {
                senders[0] = alice; receivers[0] = bob;
                senders[1] = bob; receivers[1] = charlie;
                senders[2] = charlie; receivers[2] = david;
                senders[3] = david; receivers[3] = alice;
            } else if (round % 4 == 1) {
                senders[0] = alice; receivers[0] = charlie;
                senders[1] = bob; receivers[1] = david;
                senders[2] = charlie; receivers[2] = alice;
                senders[3] = david; receivers[3] = bob;
            } else if (round % 4 == 2) {
                senders[0] = alice; receivers[0] = david;
                senders[1] = bob; receivers[1] = alice;
                senders[2] = charlie; receivers[2] = bob;
                senders[3] = david; receivers[3] = charlie;
            } else {
                senders[0] = alice; receivers[0] = alice; // Self transfer
                senders[1] = bob; receivers[1] = bob;
                senders[2] = charlie; receivers[2] = charlie;
                senders[3] = david; receivers[3] = david;
            }
            
            // Execute transfers for each token
            usdc.simulateTransfers(senders, receivers, 100e6);
            usdt.simulateTransfers(senders, receivers, 100e6);
            dai.simulateTransfers(senders, receivers, 100e18);
        }
    }
    
    /**
     * @dev Get total balances for all users
     */
    function getTotalBalances() external view returns (
        uint256 usdcTotal,
        uint256 usdtTotal,
        uint256 daiTotal
    ) {
        address[] memory users = new address[](4);
        users[0] = alice;
        users[1] = bob;
        users[2] = charlie;
        users[3] = david;
        
        for (uint256 i = 0; i < users.length; i++) {
            usdcTotal += usdc.balanceOf(users[i]);
            usdtTotal += usdt.balanceOf(users[i]);
            daiTotal += dai.balanceOf(users[i]);
        }
    }
}
