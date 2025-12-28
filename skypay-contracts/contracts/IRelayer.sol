// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IRelayer {
    // Events
    event GasPaid(address indexed user, uint256 amount, address token);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event GasPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event FeeStructureUpdated(uint256 baseFee, uint256 perByteFee);

    // Structs
    struct RelayRequest {
        address from;
        address to;
        bytes data;
        uint256 gasLimit;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    struct GasReceipt {
        address user;
        address token;
        uint256 amount;
        uint256 gasUsed;
        uint256 timestamp;
    }

    // View functions
    function getGasPrice() external view returns (uint256);
    function getBaseFee() external view returns (uint256);
    function getPerByteFee() external view returns (uint256);
    function getNonce(address user) external view returns (uint256);
    function estimateRelayCost(RelayRequest calldata request) external view returns (uint256);
    function getRelayers() external view returns (address[] memory);
    function isRelayer(address account) external view returns (bool);
    function getGasReceipt(bytes32 receiptId) external view returns (GasReceipt memory);

    // Relay functions
    function relay(RelayRequest calldata request) external returns (bytes memory);
    function relayBatch(RelayRequest[] calldata requests) external returns (bytes[] memory);
    function relayWithToken(
        RelayRequest calldata request,
        address token,
        uint256 amount
    ) external returns (bytes memory);
    
    // Gas management
    function depositGas(address token, uint256 amount) external;
    function withdrawGas(address token, uint256 amount) external;
    function getUserGasBalance(address user, address token) external view returns (uint256);
    function payGasForUser(address user, uint256 gasUsed, address token) external;

    // Admin functions
    function addRelayer(address relayer) external;
    function removeRelayer(address relayer) external;
    function setGasPrice(uint256 newPrice) external;
    function setFeeStructure(uint256 baseFee, uint256 perByteFee) external;
    function collectFees(address token) external;
    
    // Emergency
    function pauseRelaying() external;
    function unpauseRelaying() external;
}
