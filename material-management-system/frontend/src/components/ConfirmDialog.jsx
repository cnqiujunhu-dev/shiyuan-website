import React from 'react';

export default function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-title">{title}</div>
        <div className="confirm-body">{message}</div>
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
