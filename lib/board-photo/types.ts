import type { GameConfig } from '@/lib/games/catalog';
export type Box = {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};
export type OcrWord = {
    text: string;
    confidence: number;
    bbox: Box;
};
export type PhotoCell = {
    label: string;
    raw: string;
    value: number | null;
    confidence: number;
    bbox: Box;
    uncertain: boolean;
};
export type PhotoColumn = {
    id: string;
    label: string;
    bbox: Box;
    cells: PhotoCell[];
};
export type ScanResult = {
    columns: PhotoColumn[];
    warnings: string[];
};
export type EntryPlayer = {
    id: string;
    name: string;
    score: string;
    points: string;
};
export type PhotoEntry = {
    game: string;
    config: GameConfig | null;
    players: EntryPlayer[];
    winner: string;
    mode: '3da' | 'ppd';
};
export type ColumnChoice = {
    columnId: string;
    target: string;
    scoreSource: string;
    pointsSource: string;
    score: string;
    points: string;
    reviewed: boolean;
};
export type PhotoPatch = {
    players: {
        id: string;
        score?: string;
        points?: string;
    }[];
    teamScores: GameConfig['teamScores'];
};
