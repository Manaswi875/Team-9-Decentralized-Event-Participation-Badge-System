
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ParticipationBadge
 * @dev This contract mints non-transferable ERC721 Soulbound Tokens (SBTs) 
 * representing verified event participation (e.g., from Luma).
 */
contract ParticipationBadge is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Maps the unique token ID to the specific Luma Event ID
    mapping(uint256 => string) private _badgeToEventId;

    constructor() ERC721("EventParticipationBadge", "EPB") {}

    /**
     * @dev Mints a new soulbound badge to a participant's wallet.
     * Only the contract owner (which will be the automated bridge) can mint.
     * @param to The wallet address of the event participant.
     * @param eventId The off-chain Luma event identifier.
     * @return The newly generated Token ID.
     */
    function mintBadge(address to, string memory eventId) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(to, newItemId);
        _badgeToEventId[newItemId] = eventId;

        return newItemId;
    }

    /**
     * @dev Overrides standard ERC721 transfer logic to make the token Soulbound.
     * Tokens can only be minted (from address 0) or burned (to address 0).
     * Any attempt to transfer the badge between users will revert.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);

        require(from == address(0) || to == address(0), "ParticipationBadge: Token is soulbound and non-transferable.");
    }

    /**
     * @dev Retrieves the original Luma event ID associated with a specific badge.
     * Used by external stakeholders to verify a user's participation.
     * @param tokenId The ID of the soulbound token.
     * @return The string representing the event ID.
     */
    function getEventForBadge(uint256 tokenId) public view returns (string memory) {
        _requireMinted(tokenId);
        return _badgeToEventId[tokenId];
    }
}
