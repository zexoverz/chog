// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    uint256 private _nextTokenId;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    function mint(address to) external returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _mint(to, tokenId);
        return tokenId;
    }

    function mintBatch(address to, uint256 amount) external returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](amount);
        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = ++_nextTokenId;
            _mint(to, tokenId);
            tokenIds[i] = tokenId;
        }
        return tokenIds;
    }
}
