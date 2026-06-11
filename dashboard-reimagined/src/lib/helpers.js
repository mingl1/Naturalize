export const FOLDER_THEMES = [
  { bg: 'bg-[#eae6df] text-[#181715]', badgeBg: 'bg-black/10 text-[#181715]', hex: '#eae6df', textHex: '#181715' },
  { bg: 'bg-[#d6b885] text-[#181715]', badgeBg: 'bg-black/10 text-[#181715]', hex: '#d6b885', textHex: '#181715' },
  { bg: 'bg-[#181715] text-[#eae6df] border-zinc-800', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#181715', textHex: '#eae6df' },
  { bg: 'bg-[#55614e] text-[#eae6df]', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#55614e', textHex: '#eae6df' },
  { bg: 'bg-[#ad765c] text-[#eae6df]', badgeBg: 'bg-white/10 text-[#eae6df]', hex: '#ad765c', textHex: '#eae6df' },
];

// Extract clean domain from URL
export const getDomain = (url) => {
  if (!url) return 'Unknown Source';
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch (e) {
    return 'Unknown Source';
  }
};

export const getCleanDomainName = (domain) => {
  if (domain === 'Unknown Source') return 'Unknown';
  const part = domain.split('.')[0];
  return part.charAt(0).toUpperCase() + part.slice(1);
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

export const isColorLight = (hex) => {
  if (!hex) return true;
  const c = hex.substring(1);      // strip #
  const rgb = parseInt(c, 16);   // convert rrggbb to decimal
  if (isNaN(rgb)) return true;
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 128;
};

export const getBentoLayoutClasses = (index, total) => {
  if (total === 1) return "col-span-3 row-span-2";
  if (total === 2) return index === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-2";
  if (total === 3) {
    if (index === 0) return "col-span-2 row-span-2";
    if (index === 1) return "col-span-1 row-span-1";
    return "col-span-1 row-span-1";
  }
  if (index === 0) return "col-span-2 row-span-2";
  if (index === 1) return "col-span-1 row-span-1";
  if (index === 2) return "col-span-1 row-span-1";
  return "col-span-3 row-span-1";
};
