// src/AdminAction.jsx

export default function AdminAction({ children, onExecute }) {
  const handleClick = () => {
    // dummy protection (langsung jalankan)
    if (onExecute) onExecute();
  };

  return (
    <div onClick={handleClick} className="inline-block">
      {children}
    </div>
  );
}
