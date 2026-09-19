'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface SearchFormProps {
  initialQuery?: string;
}

const SUGGESTIONS = [
  'NPK',
  'Đạm Phú Mỹ',
  'Đầu Trâu',
  'Hữu cơ vi sinh',
  'Canxi Bo',
  'Phân bón lá',
];

export function SearchForm({ initialQuery = '' }: SearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/tim-kiem?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập tên phân bón, công thức (ví dụ: NPK 20-20-15, Đầu Trâu...)"
            className="pl-4 pr-10 py-3 text-sm rounded-xl h-11"
          />
        </div>
        <Button type="submit" size="default" className="h-11 px-6 font-bold space-x-1.5 rounded-xl">
          <Search className="h-4 w-4" />
          <span>Tìm kiếm</span>
        </Button>
      </form>

      {/* Suggestion tags */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="flex items-center space-x-1 text-harvest-600 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Gợi ý phổ biến:</span>
        </span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuery(s);
              router.push(`/tim-kiem?q=${encodeURIComponent(s)}`);
            }}
            className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-700 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
