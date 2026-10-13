import React, { useEffect, useRef } from 'react';
import { EMOJI_LIST } from '../context/SocketContext';

export default function EmojiPicker({ isOpen, onSelect, onClose, anchorRef }) {
    const popoverRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target) &&
                anchorRef?.current &&
                !anchorRef.current.contains(e.target)
            ) {
                onClose();
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isOpen, onClose, anchorRef]);

    if (!isOpen) return null;

    return (
        <div className="emoji-picker-popover" ref={popoverRef}>
            <div className="emoji-picker-header">Pick an emoji</div>
            <div className="emoji-grid">
                {EMOJI_LIST.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        className="emoji-item"
                        onClick={() => onSelect(emoji)}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}
