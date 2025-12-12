import styles from './Skeleton.module.css';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
}

export default function Skeleton({ className = '', variant = 'text', width, height, style: contentStyle }: SkeletonProps) {
    const style = {
        width: width,
        height: height,
        ...contentStyle
    };

    const variantClass = styles[variant] || '';

    return (
        <div
            className={`${styles.skeleton} ${variantClass} ${className}`}
            style={style}
        />
    );
}
