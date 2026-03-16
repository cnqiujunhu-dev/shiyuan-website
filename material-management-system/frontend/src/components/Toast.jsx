import React from 'react';

export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(({ id, message, type }) => (
        <div key={id} className={`toast toast-${type}`}>
          {message}
        </div>
      ))}
    </div>
  );
}
