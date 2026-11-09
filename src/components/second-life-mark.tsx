import styles from './second-life-mark.module.css';

export function SecondLifeMark({
  className,
  animation,
}: {
  className?: string;
  animation: 'hover' | 'entrance';
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 160"
      className={`${className ?? ''} ${animation === 'hover' ? styles.hover : styles.entrance}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className={styles.circle}>
        <path d="M37 67a48 48 0 0 1 82-23l10 11" />
        <path d="M129 37v18h-18" />
        <path d="M123 93a48 48 0 0 1-82 23l-10-11" />
        <path d="M31 123v-18h18" />
      </g>
      <g className={styles.arrow}>
        <path d="M80 49c-2 17-11 25-26 30 5-15 13-25 26-30Z" />
        <path d="M80 49c2 17 11 25 26 30-5-15-13-25-26-30Z" />
        <path d="M80 49v59" />
      </g>
    </svg>
  );
}
