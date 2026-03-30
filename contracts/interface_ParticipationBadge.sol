// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * This interface is the common blueprint for our Participation Badge system. 
 * Our goal is to create permanent "Soulbound" tokens that prove someone actually 
 * showed up at an event.
 * 
 * We use an interface so that different parts of our app (like the Chrome 
 * extension and our main smart contract) know exactly how to talk to each other 
 * using the same set of rules.
 */
interface IParticipationBadge {
    
    /**
     * This function issues a new badge to a verified attendee. 
     * 
     * When we confirm someone was at an event (for example, through our Luma 
     * integration), we call this to create a permanent record on the blockchain. 
     * It needs the user's wallet address ('to') and the specific Luma event 
     * identifier ('eventId') to make sure the badge is linked to the right event.
     * 
     * It returns the ID of the new badge, which is useful for logging the 
     * successful issuance.
     */
    function mintBadge(address to, string memory eventId) external returns (uint256);

    /**
     * Use this if you have a badge ID and need to know which event it was for.
     * 
     * Since a user might collect many different participation badges over time, 
     * this helper function looks up the unique event ID string that was stored 
     * when the badge was first minted.
     */
    function getEventForBadge(uint256 tokenId) external view returns (string memory);
}
