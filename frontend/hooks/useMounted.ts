'use client';
import { useEffect, useState } from 'react';

export const useMounted = (): boolean => {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
};
