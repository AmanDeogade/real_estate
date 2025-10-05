import { useEffect, useState } from 'react';

const AddLeadForm = ({ onSuccess }) => {
    const [buyers, setBuyers] = useState([]);
    const [brokers, setBrokers] = useState([]);
    const [selectedBuyer, setSelectedBuyer] = useState('');
    const [selectedBroker, setSelectedBroker] = useState('');

    useEffect(() => {
        // Fetch buyers and brokers from the backend
        Promise.all([
            fetch('/api/leads/buyers').then((res) => res.json()),
            fetch('/api/leads/brokers').then((res) => res.json()),
        ])
            .then(([buyersData, brokersData]) => {
                setBuyers(buyersData || []);
                setBrokers(brokersData || []);
            })
            .catch(() => {
                setBuyers([]);
                setBrokers([]);
            });
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const leadData = {
            // ...existing lead data collection...
            // for example: name, phone, email, etc
            ...{/* existing lead fields */},
            buyerId: selectedBuyer || null,
            brokerId: selectedBroker || null,
        };

        // Submit lead data to the backend
        fetch('/api/leads/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData),
        })
            .then((res) => res.json())
            .then((json) => {
                console.log('Lead added', json);
                if (typeof onSuccess === 'function') onSuccess(json.lead);
            })
            .catch((err) => console.error('Error adding lead', err));
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* ...existing form fields... */}

            <label htmlFor="buyer">Buyer</label>
            <select
                id="buyer"
                value={selectedBuyer}
                onChange={(e) => setSelectedBuyer(e.target.value)}
            >
                <option value="">-- Select Buyer --</option>
                {buyers.map((b) => (
                    <option key={b._id} value={b._id}>
                        {b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.email}
                    </option>
                ))}
            </select>

            <label htmlFor="broker">Assign Broker</label>
            <select
                id="broker"
                value={selectedBroker}
                onChange={(e) => setSelectedBroker(e.target.value)}
            >
                <option value="">-- None / Select Broker --</option>
                {brokers.map((b) => (
                    <option key={b._id} value={b._id}>
                        {b.name || b.email || b._id}
                    </option>
                ))}
            </select>

            {/* ...existing form fields... */}
            <button type="submit">Add Lead</button>
        </form>
    );
};

export default AddLeadForm;