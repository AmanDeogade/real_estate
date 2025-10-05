import { useEffect, useState } from 'react';

const LeadDetails = ({ lead: initialLead = {}, onRefresh }) => {
	const [lead, setLead] = useState(initialLead);
	const [brokers, setBrokers] = useState([]);
	const [selectedBroker, setSelectedBroker] = useState('');

	useEffect(() => {
		setLead(initialLead || {});
	}, [initialLead]);

	useEffect(() => {
		fetch('/api/leads/brokers')
			.then((r) => r.json())
			.then((d) => setBrokers(d || []))
			.catch(() => setBrokers([]));
	}, []);

	const handleAssignBroker = () => {
		if (!selectedBroker || !lead._id) return;
		fetch(`/api/leads/assign-broker/${lead._id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ brokerId: selectedBroker }),
		})
			.then((r) => {
				if (!r.ok) throw new Error('Failed to assign broker');
				return r.json();
			})
			.then(() => {
				const brokerObj = brokers.find((b) => String(b._id) === String(selectedBroker));
				setLead((prev) => ({
					...prev,
					brokerId: selectedBroker,
					broker: brokerObj || undefined,
				}));
				if (typeof onRefresh === 'function') onRefresh();
			})
			.catch((err) => console.error('Error assigning broker', err));
	};

	const buyerLabel = (() => {
		const b = lead.buyerInfo;
		if (!b) return 'Unknown';
		if (typeof b === 'string') return b;
		if (typeof b === 'object') return b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.email || 'Buyer';
		return String(b);
	})();

	const assignedBrokerName = (() => {
		if (lead.broker && lead.broker.name) return lead.broker.name;
		if (lead.brokerId) {
			const b = brokers.find((x) => String(x._id) === String(lead.brokerId));
			if (b) return b.name || b.email || String(b._id);
			return String(lead.brokerId);
		}
		return null;
	})();

	return (
		<div>
			<h2>Lead Details</h2>
			<p>Buyer Info: {buyerLabel}</p>
			<p>Lead Details: {lead.leadDetails || 'N/A'}</p>
			<p>Assigned Broker: {assignedBrokerName ? <span>{assignedBrokerName}</span> : <span>None</span>}</p>

			{!assignedBrokerName && (
				<div>
					<label htmlFor="assign-broker">Assign Broker</label>
					<select
						id="assign-broker"
						value={selectedBroker}
						onChange={(e) => setSelectedBroker(e.target.value)}
					>
						<option value="">-- Select Broker --</option>
						{brokers.map((b) => (
							<option key={b._id} value={b._id}>
								{b.name || b.email || b._id}
							</option>
						))}
					</select>
					<button type="button" onClick={handleAssignBroker}>
						Assign
					</button>
				</div>
			)}
		</div>
	);
};

export default LeadDetails;
