'use client';

import { useTheme } from 'next-themes';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface EmojiSelected {
  native?: string;
  shortcodes?: string;
  unified?: string;
}

interface Props {
  onSelect: (emoji: string) => void;
}

/** WhatsApp-style emoji picker with the full Unicode set, search, recents,
 *  skin tone selection, and category nav. Theme follows the app theme. */
export function EmojiPicker({ onSelect }: Props): JSX.Element {
  const { resolvedTheme } = useTheme();
  return (
    <div className="overflow-hidden rounded-xl border bg-popover shadow-2xl">
      <Picker
        data={data}
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        previewPosition="none"
        skinTonePosition="search"
        autoFocus={false}
        navPosition="top"
        perLine={8}
        maxFrequentRows={2}
        emojiSize={20}
        emojiButtonSize={32}
        onEmojiSelect={(e: EmojiSelected) => {
          if (e.native) onSelect(e.native);
        }}
      />
    </div>
  );
}
