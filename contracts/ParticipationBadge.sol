
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ParticipationBadge is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    mapping(uint256 => string) private _badgeToEventId;

    constructor() ERC721("EventParticipationBadge", "EPB") {}


    function mintBadge(address to, string memory eventId) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(to, newItemId);
        _badgeToEventId[newItemId] = eventId;

        return newItemId;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);

        require(from == address(0) || to == address(0), "ParticipationBadge: Token is soulbound and non-transferable.");
    }

    function getEventForBadge(uint256 tokenId) public view returns (string memory) {
        _requireMinted(tokenId);
        return _badgeToEventId[tokenId];
    }
}
