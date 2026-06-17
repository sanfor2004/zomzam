'use client';
import { Button } from '@/components/ui';

import { useRef, useEffect, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface MapAutocompleteProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
  disabled?: boolean;
  value?: string;
  onChange?: (val: string) => void;
  onGetPin?: () => void;
}

export const MapAutocomplete = ({ onPlaceSelect, disabled, value, onChange, onGetPin }: MapAutocompleteProps) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current || disabled) return;

    const options = {
      fields: ['geometry', 'name', 'formatted_address', 'types', 'place_id']
    };

    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places, disabled]);

  useEffect(() => {
    if (!placeAutocomplete || disabled) return;

    const listener = placeAutocomplete.addListener('place_changed', () => {
      onPlaceSelect(placeAutocomplete.getPlace());
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [onPlaceSelect, placeAutocomplete, disabled]);

  return (
    <div className="relative w-full flex items-center">
      <input
        ref={inputRef}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full text-xs bg-white/[0.01] border border-white/5 focus:border-[#EE5712]/40 rounded-xl pl-4 pr-20 py-2 text-gray-200 placeholder-gray-600 outline-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        placeholder={disabled ? "Configure Maps API Key to search" : "e.g. Downtown Los Angeles"}
      />
      {onGetPin && !disabled && (
        <Button variant="unstyled"
          type="button"
          onClick={onGetPin}
          className="absolute right-1.5 px-2.5 py-1 bg-[#EE5712]/10 hover:bg-[#EE5712]/20 text-[#EE5712] border border-[#EE5712]/25 text-[9px] font-extrabold uppercase rounded-lg tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          Get pin
        </Button>
      )}
    </div>
  );
};
