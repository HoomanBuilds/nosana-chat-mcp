
export class AdvancedSearch {
    static normalize(text: string): string {
        return text.toLowerCase().trim().replace(/[^\w\s]/g, '');
    }

    static levenshteinDistance(a: string, b: string): number {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) {
            matrix[0][i] = i;
        }

        for (let j = 0; j <= b.length; j++) {
            matrix[j][0] = j;
        }

        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1, // deletion
                    matrix[j - 1][i] + 1, // insertion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }

        return matrix[b.length][a.length];
    }

    static similarity(a: string, b: string): number {
        const distance = this.levenshteinDistance(a, b);
        const maxLength = Math.max(a.length, b.length);
        return maxLength === 0 ? 1 : 1 - distance / maxLength;
    }

    static tokenize(text: string): string[] {
        return this.normalize(text).split(/\s+/).filter(token => token.length > 0);
    }

    static scoreMatch(text: string, query: string): { score: number; matchType: "exact" | "partial" | "fuzzy" } {
        const normalizedText = this.normalize(text);
        const normalizedQuery = this.normalize(query);

        if (!normalizedQuery) return { score: 0, matchType: "fuzzy" };

        let score = 0;
        let matchType: "exact" | "partial" | "fuzzy" = "fuzzy";

        if (normalizedText === normalizedQuery) {
            score += 100;
            matchType = "exact";
        }

        if (normalizedText.startsWith(normalizedQuery)) {
            score += 80;
            matchType = "exact";
        }

        if (normalizedText.includes(normalizedQuery)) {
            score += 60;
            matchType = matchType === "fuzzy" ? "partial" : matchType;
        }

        const textTokens = this.tokenize(text);
        const queryTokens = this.tokenize(query);

        let exactWordMatches = 0;
        let partialWordMatches = 0;
        let fuzzyWordMatches = 0;

        queryTokens.forEach(queryToken => {
            let matched = false;

            textTokens.forEach(textToken => {
                if (textToken === queryToken) {
                    exactWordMatches++;
                    score += 20;
                    matched = true;
                    matchType = matchType === "fuzzy" ? "exact" : matchType;
                }
            });

            if (!matched) {
                textTokens.forEach(textToken => {
                    if (textToken.includes(queryToken) && queryToken.length > 2) {
                        partialWordMatches++;
                        score += 15;
                        matched = true;
                        matchType = matchType === "fuzzy" ? "partial" : matchType;
                    }
                });
            }

            if (!matched) {
                textTokens.forEach(textToken => {
                    const similarity = this.similarity(textToken, queryToken);
                    if (similarity > 0.8 && queryToken.length > 2) {
                        fuzzyWordMatches++;
                        score += Math.floor(similarity * 10);
                        matched = true;
                    }
                });
            }

            if (exactWordMatches + partialWordMatches + fuzzyWordMatches === queryTokens.length) {
                score += 25;
            }
        });

        const lengthRatio = text.length / query.length;
        if (lengthRatio < 0.5) {
            score *= 0.8; // Penalize very short matches
        } else if (lengthRatio > 3) {
            score *= 0.9; // Slight penalty for very long matches
        }

        if (text.toLowerCase().includes("chat") && query.toLowerCase().includes("chat")) {
            score += 5;
        }

        if (text.toLowerCase().includes("settings") && query.toLowerCase().includes("settings")) {
            score += 5;
        }

        return { score: Math.min(score, 100), matchType };
    }

    static boostScore(baseScore: number, text: string, query: string): number {
        let boostedScore = baseScore;

        if (query.startsWith('/')) {
            const commandQuery = query.slice(1);
            if (text.toLowerCase().includes(commandQuery)) {
                boostedScore += 15;
            }
        }

        const synonymMap: { [key: string]: string[] } = {
            'del': ['delete', 'remove'],
            'rm': ['delete', 'remove'],
            'config': ['settings', 'configuration'],
            'cfg': ['settings', 'configuration'],
            'import': ['upload', 'restore'],
            'export': ['download', 'backup']
        };

        Object.entries(synonymMap).forEach(([short, synonyms]) => {
            if (query.includes(short) && synonyms.some(syn => text.toLowerCase().includes(syn))) {
                boostedScore += 10;
            }
        });

        return Math.min(boostedScore, 100);
    }
}