document.getElementById('agent-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('agentQuery').value.trim();
    if (!query) return;

    // Show a loading message or spinner if needed
    document.getElementById('agentResponse').innerHTML = '<p>Loading recommendations...</p>';

    try {
        const response = await fetch('/ai-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        if (data && data.recommendation) {
            document.getElementById('agentResponse').innerHTML = `<p>${data.recommendation}</p>`;
        } else {
            document.getElementById('agentResponse').innerHTML = '<p>No recommendations available.</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('agentResponse').innerHTML = '<p>Error retrieving recommendations.</p>';
    }
});