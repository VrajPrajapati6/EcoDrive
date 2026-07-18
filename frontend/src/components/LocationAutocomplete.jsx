import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

export default function LocationAutocomplete({ value, onChange, placeholder, required }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lastSelected, setLastSelected] = useState('');

  const containerRef = useRef(null);

  // Sync value from parent prop
  useEffect(() => {
    setInputValue(value || '');
    setLastSelected(value || '');
  }, [value]);

  // Debounced search query
  useEffect(() => {
    if (!inputValue || inputValue === lastSelected) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchSuggestions(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, lastSelected]);

  // Click outside to close dropdown and revert to last selected location if not matching
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        closeAndRevert();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputValue, lastSelected]);

  const fetchSuggestions = async (query) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      if (!response.ok) {
        throw new Error('OpenStreetMap API request failed');
      }
      const data = await response.json();
      setSuggestions(data || []);
      setIsOpen(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const closeAndRevert = () => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (inputValue !== lastSelected) {
      const resetValue = lastSelected || '';
      setInputValue(resetValue);
      onChange(resetValue);
    }
  };

  const handleBlur = () => {
    // Use timeout to allow click event on suggestion list to process first
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        closeAndRevert();
      }
    }, 150);
  };

  const handleSelect = (item) => {
    const name = item.display_name;
    setInputValue(name);
    setLastSelected(name);
    onChange(name);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen && suggestions.length > 0) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      } else if (isOpen) {
        // If dropdown is open but no suggestion selected, prevent submitting form on enter
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAndRevert();
    }
  };

  return (
    <div className="autocomplete-wrapper" ref={containerRef}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-control autocomplete-input"
          placeholder={placeholder}
          required={required}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
        <div className="autocomplete-loader-wrapper">
          {loading ? (
            <div className="autocomplete-spinner" />
          ) : (
            <MapPin size={16} color="var(--text-muted)" style={{ opacity: 0.6 }} />
          )}
        </div>
      </div>

      {isOpen && (suggestions.length > 0 || loading) && (
        <ul className="autocomplete-dropdown">
          {loading && suggestions.length === 0 ? (
            <li className="autocomplete-item loading" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Searching locations...
            </li>
          ) : (
            suggestions.map((item, index) => {
              const isItemActive = index === activeIndex;
              const isItemSelected = item.display_name === lastSelected;
              return (
                <li
                  key={item.place_id || index}
                  className={`autocomplete-item ${isItemActive ? 'active' : ''} ${isItemSelected ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  title={item.display_name}
                >
                  {item.display_name}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
