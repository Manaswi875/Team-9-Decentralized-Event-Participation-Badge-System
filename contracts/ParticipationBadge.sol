// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interface_ParticipationBadge.sol";

/**
 * ParticipationBadge - Mints non-transferable ERC721 Soulbound Tokens (SBTs)
 * representing verified event participation (e.g., from Luma).
 *
 * Changes over v1:
 *  - Duplicate prevention: a wallet cannot receive more than one badge per event.
 *  - On-chain metadata: tokenURI returns a fully self-contained Base64-encoded
 *    JSON blob with name, description, an SVG image, and event attributes.
 *    No external server or IPFS dependency required.
 */
contract ParticipationBadge is ERC721, Ownable, IParticipationBadge {
    using Counters for Counters.Counter;
    using Strings for uint256;

    Counters.Counter private _tokenIds;

    // Maps token ID → event ID string
    mapping(uint256 => string) private _badgeToEventId;

    // Duplicate guard: wallet address → event ID → already minted?
    // Public so Solidity auto-generates the hasBadge(address, string) getter,
    // satisfying the IParticipationBadge interface without extra code.
    mapping(address => mapping(string => bool)) public override hasBadge;

    // Emitted on every successful mint for easy off-chain indexing
    event BadgeMinted(address indexed to, uint256 indexed tokenId, string eventId);

    constructor() ERC721("EventParticipationBadge", "EPB") {}

    // ─── Minting ─────────────────────────────────────────────────────────────

    /**
     * Mints a new soulbound badge to a participant's wallet.
     * Only the contract owner (the automated backend relayer) can mint.
     *
     * @param to      - The wallet address of the event participant.
     * @param eventId - The unique identifier of the Luma event.
     * @return The newly generated token ID.
     *
     * Reverts if `to` already holds a badge for `eventId`.
     */
    function mintBadge(address to, string memory eventId)
        public
        onlyOwner
        override
        returns (uint256)
    {
        // ── Duplicate check ──────────────────────────────────────────────────
        require(
            !hasBadge[to][eventId],
            "ParticipationBadge: Badge already issued to this address for this event."
        );

        // ── Mint ─────────────────────────────────────────────────────────────
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(to, newItemId);
        _badgeToEventId[newItemId] = eventId;

        // ── Record the mint so future calls for the same wallet+event revert ─
        hasBadge[to][eventId] = true;

        emit BadgeMinted(to, newItemId, eventId);

        return newItemId;
    }

    // ─── Soulbound enforcement ────────────────────────────────────────────────

    /**
     * Overrides ERC721 transfer logic to make every token Soulbound.
     * Minting (from == address(0)) and burning (to == address(0)) are allowed.
     * Any wallet-to-wallet transfer reverts.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        require(
            from == address(0) || to == address(0),
            "ParticipationBadge: This badge is permanent and cannot be moved."
        );
    }

    // ─── Metadata ─────────────────────────────────────────────────────────────

    /**
     * Returns a fully on-chain Base64-encoded JSON metadata URI.
     *
     * The JSON follows the standard ERC-721 metadata schema:
     *   { name, description, image (SVG), attributes }
     *
     * Everything is generated and stored on-chain — no IPFS or external
     * server is needed to display the badge in wallets and marketplaces.
     *
     * @param tokenId - The ID of the soulbound token.
     * @return A data URI string: "data:application/json;base64,<encoded JSON>"
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireMinted(tokenId);

        string memory eventId = _badgeToEventId[tokenId];
        string memory tokenIdStr = tokenId.toString();

        // ── Build the SVG badge image ─────────────────────────────────────────
        // Rendered on-chain so it is permanently available without any CDN.
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">',
              '<defs>',
                '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
                  '<stop offset="0%" style="stop-color:#0052FF;stop-opacity:1"/>',
                  '<stop offset="100%" style="stop-color:#0036A8;stop-opacity:1"/>',
                '</linearGradient>',
              '</defs>',
              '<rect width="300" height="300" rx="24" fill="url(#bg)"/>',
              '<text x="150" y="110" font-family="Arial,sans-serif" font-size="64" ',
                'text-anchor="middle" fill="white">&#127941;</text>',
              '<text x="150" y="165" font-family="Arial,sans-serif" font-size="16" ',
                'font-weight="bold" text-anchor="middle" fill="white">',
                'PARTICIPATION BADGE',
              '</text>',
              '<text x="150" y="195" font-family="Arial,sans-serif" font-size="11" ',
                'text-anchor="middle" fill="rgba(255,255,255,0.75)">',
                eventId,
              '</text>',
              '<text x="150" y="268" font-family="Arial,sans-serif" font-size="10" ',
                'text-anchor="middle" fill="rgba(255,255,255,0.5)">',
                'Token #', tokenIdStr, ' &bull; Base Blockchain',
              '</text>',
            '</svg>'
        ));

        // ── Base64-encode the SVG so it embeds cleanly in the JSON ────────────
        string memory imageURI = string(abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(svg))
        ));

        // ── Build the JSON metadata object ────────────────────────────────────
        string memory json = string(abi.encodePacked(
            '{',
              '"name": "Event Participation Badge #', tokenIdStr, '",',
              '"description": "A soulbound participation badge for event ', eventId,
                '. Issued on the Base blockchain via the Luma Badge Bridge. Non-transferable.",',
              '"image": "', imageURI, '",',
              '"attributes": [',
                '{"trait_type": "Event ID", "value": "', eventId, '"},',
                '{"trait_type": "Token ID", "value": "', tokenIdStr, '"},',
                '{"trait_type": "Soulbound", "value": "true"}',
              ']',
            '}'
        ));

        // ── Wrap in a data URI and return ─────────────────────────────────────
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // ─── Read helpers ─────────────────────────────────────────────────────────

    /**
     * Retrieves the event ID associated with a specific badge.
     * Used by external verifiers to confirm a user's participation.
     *
     * @param tokenId - The ID of the soulbound token.
     * @return The event ID string stored at mint time.
     */
    function getEventForBadge(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireMinted(tokenId);
        return _badgeToEventId[tokenId];
    }
}
