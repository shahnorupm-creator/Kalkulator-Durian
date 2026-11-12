import type { KunciFasa } from '@/lib/permainan/kebunMaya';

interface PokokSvgProps {
  fasa: KunciFasa;
  label: string;
  /** Kelewatan animasi (saat) supaya pokok tidak bergoyang serentak. */
  kelewatan?: number;
}

// Titik tetap pada tajuk pokok untuk tunas, bunga dan buah.
const TITIK: [number, number][] = [
  [22, 26],
  [41, 22],
  [31, 36],
  [46, 38],
  [17, 40],
];

function Hiasan({ fasa }: { fasa: KunciFasa }) {
  switch (fasa) {
    case 'mataketam':
      // Tunas baharu: pucuk kecil muda yang menyembul.
      return (
        <g>
          {TITIK.map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx={1.6} ry={3} fill="#C6E88A" transform={`rotate(${i % 2 ? 20 : -20} ${x} ${y})`} />
          ))}
        </g>
      );
    case 'berbunga':
      // Bunga putih krim berpusat emas.
      return (
        <g>
          {TITIK.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={3.4} fill="#FFF6D6" />
              <circle cx={x} cy={y} r={1.2} fill="#D9AD32" />
            </g>
          ))}
        </g>
      );
    case 'putik':
      // Putik: butir hijau sangat kecil pada tangkai pendek.
      return (
        <g>
          {TITIK.map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y - 5} x2={x} y2={y - 1} stroke="#6B4A2B" strokeWidth={0.9} />
              <circle cx={x} cy={y + 1} r={2.1} fill="#B7E07A" />
            </g>
          ))}
        </g>
      );
    case 'kecil':
      // Buah kecil bulat tergantung.
      return (
        <g>
          {TITIK.slice(0, 4).map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y - 6} x2={x} y2={y} stroke="#6B4A2B" strokeWidth={1} />
              <circle cx={x} cy={y + 3} r={4.6} fill="#9ACD32" stroke="#5E8B1C" strokeWidth={0.9} />
            </g>
          ))}
        </g>
      );
    case 'besar':
      // Buah besar berduri: cincin putus-putus meniru duri.
      return (
        <g>
          {TITIK.slice(0, 3).map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y - 7} x2={x} y2={y - 1} stroke="#6B4A2B" strokeWidth={1.2} />
              <circle cx={x} cy={y + 4} r={7} fill="#C9D862" />
              <circle cx={x} cy={y + 4} r={8.2} fill="none" stroke="#5E7A1E" strokeWidth={2.4} strokeDasharray="1.2 2.6" />
              <circle cx={x} cy={y + 4} r={2} fill="#E8EFA6" opacity={0.8} />
            </g>
          ))}
        </g>
      );
    case 'tidak':
    default:
      // Tidak berbuah: tajuk tanpa sebarang hiasan.
      return null;
  }
}

export default function PokokSvg({ fasa, label, kelewatan = 0 }: PokokSvgProps) {
  const daun = fasa === 'tidak' ? '#8DB59C' : '#2E7D4F';
  const daunMuda = fasa === 'tidak' ? '#A3C7B0' : '#3C9560';

  return (
    <svg
      viewBox="0 0 64 80"
      role="img"
      aria-label={label}
      className="pokok-goyang h-auto w-full"
      style={{ animationDelay: `${kelewatan}s` }}
    >
      <ellipse cx="32" cy="75" rx="16" ry="3.5" fill="#0B3326" opacity="0.18" />
      <rect x="29" y="44" width="6" height="31" rx="2" fill="#6B4A2B" />
      <circle cx="32" cy="30" r="22" fill={daun} />
      <circle cx="20" cy="37" r="14" fill={daunMuda} />
      <circle cx="44" cy="37" r="14" fill={daunMuda} />
      <Hiasan fasa={fasa} />
    </svg>
  );
}
