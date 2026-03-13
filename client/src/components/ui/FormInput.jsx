export default function FormInput({ label, required, error, type = 'text', className = '', ...props }) {
  const baseClass = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2';
  const errorClass = error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500';

  return (
    <div>
      {label && (
        <label htmlFor={props.id || props.name} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea className={`${baseClass} ${errorClass} ${className}`} {...props} />
      ) : type === 'select' ? (
        <select className={`${baseClass} ${errorClass} ${className}`} {...props} />
      ) : (
        <input type={type} className={`${baseClass} ${errorClass} ${className}`} {...props} />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
