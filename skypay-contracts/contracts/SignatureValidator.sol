// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

library SignatureValidator {
    using ECDSA for bytes32;
    
    bytes32 private constant _TRANSACTION_TYPEHASH = keccak256(
        "Transaction(address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"
    );
    
    bytes32 private constant _PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );
    
    bytes32 private constant _BRIDGE_TYPEHASH = keccak256(
        "BridgeRequest(address user,address token,uint256 amount,uint256 sourceChain,uint256 destChain,address destAddress,uint256 nonce,uint256 deadline)"
    );

    function validateTransactionSignature(
        address to,
        uint256 value,
        bytes memory data,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature,
        address expectedSigner
    ) internal view returns (bool) {
        bytes32 structHash = keccak256(abi.encode(
            _TRANSACTION_TYPEHASH,
            to,
            value,
            keccak256(data),
            nonce,
            deadline
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        
        return signer == expectedSigner;
    }

    function validatePermitSignature(
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) internal view returns (address) {
        bytes32 structHash = keccak256(abi.encode(
            _PERMIT_TYPEHASH,
            owner,
            spender,
            value,
            nonce,
            deadline
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        return hash.recover(signature);
    }

    function validateBridgeSignature(
        address user,
        address token,
        uint256 amount,
        uint256 sourceChain,
        uint256 destChain,
        address destAddress,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) internal view returns (address) {
        bytes32 structHash = keccak256(abi.encode(
            _BRIDGE_TYPEHASH,
            user,
            token,
            amount,
            sourceChain,
            destChain,
            destAddress,
            nonce,
            deadline
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        return hash.recover(signature);
    }

    function recoverSigner(bytes32 hash, bytes memory signature) 
        internal 
        pure 
        returns (address) 
    {
        return hash.recover(signature);
    }

    function isValidSignature(
        address signer,
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (bool) {
        return hash.recover(signature) == signer;
    }

    function _hashTypedDataV4(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    function _domainSeparatorV4() private view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("SkyPay")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }
}
