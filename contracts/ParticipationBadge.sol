// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interface_ParticipationBadge.sol";

// Implementation of Soulbound Participation Badges
contract ParticipationBadge is ERC721, Ownable, IParticipationBadge {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // maps each unique badge ID to its specific Event ID string
    mapping(uint256 => string) private _badgeToEventId;

    constructor() ERC721("EventParticipationBadge", "EPB") {}

    // Mints a badge for an attendee (Owner only)
    function mintBadge(address to, string memory eventId) public onlyOwner override returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(to, newItemId);
        _badgeToEventId[newItemId] = eventId;

        return newItemId;
    }

    /**
     * making the token "Soulbound." 
     * override the standard transfer logic so it only allows the token to be minted or burned. 
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);

        // allow minting (from 0) and burning (to 0), but block everything else
        require(from == address(0) || to == address(0), "ParticipationBadge: This badge is permanent and cannot be moved.");
    }

    // Returns event ID for a given badge
    function getEventForBadge(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _badgeToEventId[tokenId];
    }
}
