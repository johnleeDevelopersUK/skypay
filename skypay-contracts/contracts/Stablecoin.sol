// skypay-contracts/contracts/Stablecoin.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SkyPay Stablecoin
 * @notice Token-backed stablecoin with mint/burn controls
 */
contract Stablecoin is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // Vault address
    address public vault;
    
    // Transfer restrictions
    mapping(address => bool) private _frozen;
    
    // Events
    event Minted(address indexed to, uint256 amount, string currency);
    event Burned(address indexed from, uint256 amount, string currency);
    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    
    constructor(
        string memory name,
        string memory symbol,
        address admin
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        
        // Initial supply can be minted by admin
        _mint(admin, 1000000 * 10 ** decimals()); // 1M initial supply
    }
    
    /**
     * @notice Mint tokens (only vault or minter)
     */
    function mint(
        address to,
        uint256 amount,
        string calldata currency
    ) external whenNotPaused {
        require(
            hasRole(MINTER_ROLE, msg.sender) || msg.sender == vault,
            "Caller is not minter or vault"
        );
        require(!_frozen[to], "Recipient account is frozen");
        require(amount > 0, "Amount must be positive");
        
        _mint(to, amount);
        emit Minted(to, amount, currency);
    }
    
    /**
     * @notice Burn tokens (only vault or burner)
     */
    function burn(
        address from,
        uint256 amount,
        string calldata currency
    ) external whenNotPaused {
        require(
            hasRole(BURNER_ROLE, msg.sender) || msg.sender == vault,
            "Caller is not burner or vault"
        );
        require(!_frozen[from], "Account is frozen");
        require(balanceOf(from) >= amount, "Insufficient balance");
        
        _burn(from, amount);
        emit Burned(from, amount, currency);
    }
    
    /**
     * @notice Set vault address
     */
    function setVault(address newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newVault != address(0), "Invalid vault address");
        address oldVault = vault;
        vault = newVault;
        
        // Grant minter/burner roles to vault
        _grantRole(MINTER_ROLE, newVault);
        _grantRole(BURNER_ROLE, newVault);
        
        // Revoke roles from old vault
        if (oldVault != address(0)) {
            _revokeRole(MINTER_ROLE, oldVault);
            _revokeRole(BURNER_ROLE, oldVault);
        }
        
        emit VaultUpdated(oldVault, newVault);
    }
    
    /**
     * @notice Freeze account (compliance)
     */
    function freezeAccount(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!_frozen[account], "Account already frozen");
        _frozen[account] = true;
        emit AccountFrozen(account);
    }
    
    /**
     * @notice Unfreeze account
     */
    function unfreezeAccount(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_frozen[account], "Account not frozen");
        _frozen[account] = false;
        emit AccountUnfrozen(account);
    }
    
    /**
     * @notice Check if account is frozen
     */
    function isFrozen(address account) external view returns (bool) {
        return _frozen[account];
    }
    
    /**
     * @notice Pause all token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Override transfer with freeze check
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        require(!_frozen[from], "Sender account is frozen");
        require(!_frozen[to], "Recipient account is frozen");
        
        super._beforeTokenTransfer(from, to, amount);
    }
    
    /**
     * @notice Get token details
     */
    function getDetails() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint256 totalSupply,
        uint8 decimals_,
        address vaultAddress
    ) {
        return (
            name(),
            symbol(),
            totalSupply(),
            decimals(),
            vault
        );
    }
}
