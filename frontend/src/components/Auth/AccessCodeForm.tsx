import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui';

interface AccessCodeFormProps {
  onSubmit: (code: string) => Promise<boolean>;
}

export function AccessCodeForm({ onSubmit }: AccessCodeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code.trim()) {
      setError('Digite um codigo de acesso');
      return;
    }

    setLoading(true);
    const success = await onSubmit(code);
    setLoading(false);

    if (!success) {
      setError('Codigo de acesso invalido');
      setCode('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div>
        <label
          htmlFor="access-code"
          className="block text-sm font-medium text-gray-600 mb-2"
        >
          Codigo de Acesso
        </label>
        <input
          id="access-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX"
          className="w-full px-4 py-4 bg-white border border-gray-300 rounded-lg
                     text-center text-xl font-mono tracking-widest uppercase
                     text-black placeholder:text-gray-300
                     focus:border-black focus:ring-0 transition-colors outline-none"
          disabled={loading}
          autoComplete="off"
          autoFocus
          maxLength={12}
        />
      </div>

      {error && (
        <div className="text-red-500 text-sm text-center py-2">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={loading}
      >
        {loading ? 'Verificando...' : 'Entrar'}
      </Button>
    </form>
  );
}
