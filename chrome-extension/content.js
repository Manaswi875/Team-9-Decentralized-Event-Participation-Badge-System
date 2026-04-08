(function() {
  // We only run this logic if we are on a Luma page. 
  // Since the manifest already restricts to *://lu.ma/*, we're safe.
  
  function getEventContext() {
    // Attempt to parse some event context from the page
    const pageTitle = document.title || "Unknown Luma Event";
    // Generate a pseudo-random ID for the event using a simple hash or just the URL
    const eventId = "LUMA-EVT-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    return {
      eventName: pageTitle,
      eventId: eventId
    };
  }

  function injectSimulationButton() {
    // Defensive check to not inject multiple times
    if(document.getElementById('web3-luma-bridge-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'web3-luma-bridge-btn';
    btn.className = 'web3-luma-btn';
    btn.innerText = 'Mint Badge (Simulate Registration)';

    btn.addEventListener('click', async () => {
      btn.innerText = 'Minting...';
      btn.disabled = true;

      const eventContext = getEventContext();

      try {
        const response = await fetch('http://localhost:3000/api/mint', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ eventContext })
        });

        const data = await response.json();

        if (response.ok) {
          showSuccessUI(data.dummyAddress, data.transactionHash, eventContext.eventName);
        } else {
          alert('Minting failed: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error communicating with backend:', error);
        alert('Could not connect to backend server. Is it running?');
      } finally {
        btn.innerText = 'Mint Badge (Simulate Registration)';
        btn.disabled = false;
      }
    });

    document.body.appendChild(btn);
  }

  function showSuccessUI(dummyAddress, txHash, eventName) {
    // Remove if already exists
    const existing = document.getElementById('web3-success-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'web3-success-modal';
    modal.className = 'web3-modal-overlay';
    
    modal.innerHTML = `
      <div class="web3-modal-content">
        <div class="web3-modal-header">
          <h2>🎉 Registration Verified!</h2>
        </div>
        <div class="web3-modal-body">
          <p>You have successfully registered for <strong>${eventName}</strong>.</p>
          <p class="web3-highlight">Your Participation Badge has been permanently stored on the Base blockchain.</p>
          <div class="web3-tx-info">
            <p><strong>Sent To (Dummy Account):</strong> <br/> <code>${dummyAddress}</code></p>
            <p><strong>Transaction Hash:</strong> <br/> <code>${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}</code></p>
          </div>
        </div>
        <button id="web3-modal-close" class="web3-close-btn">Awesome!</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('web3-modal-close').addEventListener('click', () => {
      modal.remove();
    });
  }

  // Inject the button when the script runs
  injectSimulationButton();

})();
