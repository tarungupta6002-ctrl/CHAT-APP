import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export default function EditModal() {
    const { editingMessage, setEditingMessage, editMessage } = useSocket();
    const [editText, setEditText] = useState('');

    useEffect(() => {
        if (editingMessage) {
            setEditText(editingMessage.text || '');
        }
    }, [editingMessage]);

    if (!editingMessage) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editText.trim()) {
            editMessage(editingMessage.id, editText.trim());
            setEditingMessage(null);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="join-card">
                <h2>Edit Message</h2>
                <form onSubmit={handleSubmit}>
                    <div className="input-group" style={{ marginTop: '1rem' }}>
                        <input
                            type="text"
                            className="styled-input"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            required
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                        <button
                            type="button"
                            className="cancel-recording-btn"
                            onClick={() => setEditingMessage(null)}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ width: 'auto', padding: '0.5rem 1.25rem' }}
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
