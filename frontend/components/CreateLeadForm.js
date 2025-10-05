import { useEffect, useState } from 'react';

const CreateLeadForm = ({ onCreated }) => {
	const [buyers, setBuyers] = useState([]);
	const [brokers, setBrokers] = useState([]);
	const [selectedBuyer, setSelectedBuyer] = useState('');
	const [selectedBroker, setSelectedBroker] = useState('');

	useEffect(() => {
		fetch('/api/leads/buyers').then((r) => r.json()).then((d) => setBuyers(d || [])).catch(() => setBuyers([]));
		fetch('/api/leads/brokers')
			.then((r) => r.json())
			.then((data) => setBrokers(data || []))
			.catch((err) => {
				console.error('Failed to load brokers', err);
				setBrokers([]);
			});
	}, []);

	const handleSubmit = (e) => {
		e.preventDefault();
		const leadData = {
			// ...existing lead data...
			...{/* existing lead fields */},
			buyerId: selectedBuyer || null,
			brokerId: selectedBroker || null,
		};

		// Submit lead data to the backend
		fetch('/api/leads/create', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(leadData),
		})
			.then((res) => res.json())
			.then((json) => {
				console.log('Lead created', json);
				if (typeof onCreated === 'function') onCreated(json.lead);
			})
			.catch((err) => console.error('Error creating lead', err));
	};

	return (
		<form onSubmit={handleSubmit}>
			{/* ...existing form fields... */}

			<label htmlFor="buyer">Buyer</label>
			<select id="buyer" value={selectedBuyer} onChange={(e) => setSelectedBuyer(e.target.value)}>
				<option value="">-- Select Buyer --</option>
				{buyers.map((b) => (
					<option key={b._id} value={b._id}>
						{b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.email}
					</option>
				))}
			</select>

			<label htmlFor="broker">Broker</label>
			<select
				id="broker"
				value={selectedBroker}
				onChange={(e) => setSelectedBroker(e.target.value)}
			>
				<option value="">-- Select Broker (optional) --</option>
				{brokers.map((b) => (
					<option key={b._id} value={b._id}>
						{b.name || b.email || b._id}
					</option>
				))}
			</select>

			{/* ...existing form fields... */}
			<button type="submit">Create Lead</button>
		</form>
	);
};

export default CreateLeadForm;