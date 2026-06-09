class ChessGame {
    constructor() {
        this.board = [];
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.initializeBoard();
        this.renderBoard();
        this.attachEventListeners();
    }

    initializeBoard() {
        const initialPosition = [
            ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
            ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
            ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
        ];

        this.board = initialPosition.map(row => [...row]);
    }

    renderBoard() {
        const boardElement = document.getElementById('chess-board');
        boardElement.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('span');
                    pieceElement.className = 'piece';
                    pieceElement.textContent = piece;
                    pieceElement.draggable = true;
                    square.appendChild(pieceElement);
                }

                boardElement.appendChild(square);
            }
        }

        this.updateTurnIndicator();
        this.updateGameStatus();
    }

    attachEventListeners() {
        const boardElement = document.getElementById('chess-board');
        
        boardElement.addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (square) {
                this.handleSquareClick(square);
            }
        });

        boardElement.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('piece')) {
                const square = e.target.closest('.square');
                const row = parseInt(square.dataset.row);
                const col = parseInt(square.dataset.col);
                
                if (this.isPieceOwnedByCurrentPlayer(row, col)) {
                    e.target.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', `${row},${col}`);
                    this.selectedSquare = { row, col };
                    this.highlightValidMoves(row, col);
                } else {
                    e.preventDefault();
                }
            }
        });

        boardElement.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('piece')) {
                e.target.classList.remove('dragging');
                this.clearHighlights();
            }
        });

        boardElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        boardElement.addEventListener('drop', (e) => {
            e.preventDefault();
            const square = e.target.closest('.square');
            if (square && this.selectedSquare) {
                const targetRow = parseInt(square.dataset.row);
                const targetCol = parseInt(square.dataset.col);
                this.attemptMove(this.selectedSquare.row, this.selectedSquare.col, targetRow, targetCol);
            }
            this.selectedSquare = null;
        });

        document.getElementById('new-game-btn').addEventListener('click', () => this.resetGame());
        document.getElementById('reset-btn').addEventListener('click', () => this.resetGame());
        document.getElementById('undo-btn').addEventListener('click', () => this.undoLastMove());
    }

    handleSquareClick(square) {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);

        if (this.selectedSquare) {
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this.clearSelection();
            } else {
                this.attemptMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
            }
        } else if (this.board[row][col] && this.isPieceOwnedByCurrentPlayer(row, col)) {
            this.selectSquare(row, col);
        }
    }

    selectSquare(row, col) {
        this.clearSelection();
        this.selectedSquare = { row, col };
        const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        square.classList.add('selected');
        this.highlightValidMoves(row, col);
    }

    clearSelection() {
        this.selectedSquare = null;
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.clearHighlights();
    }

    clearHighlights() {
        document.querySelectorAll('.valid-move, .capture-move').forEach(el => {
            el.classList.remove('valid-move', 'capture-move');
        });
    }

    highlightValidMoves(row, col) {
        const validMoves = this.getValidMoves(row, col);
        validMoves.forEach(move => {
            const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
            if (this.board[move.row][move.col]) {
                square.classList.add('capture-move');
            } else {
                square.classList.add('valid-move');
            }
        });
    }

    isPieceOwnedByCurrentPlayer(row, col) {
        const piece = this.board[row][col];
        if (!piece) return false;
        
        const isWhitePiece = '♔♕♖♗♘♙'.includes(piece);
        const isBlackPiece = '♚♛♜♝♞♟'.includes(piece);
        
        return (this.currentTurn === 'white' && isWhitePiece) || 
               (this.currentTurn === 'black' && isBlackPiece);
    }

    getValidMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        const moves = this.getPossibleMoves(row, col, piece);
        return moves.filter(move => this.isValidMove(row, col, move.row, move.col));
    }

    getPossibleMoves(row, col, piece) {
        const moves = [];
        
        switch (piece) {
            case '♙': // White pawn
                if (row > 0 && !this.board[row - 1][col]) {
                    moves.push({ row: row - 1, col });
                    if (row === 6 && !this.board[row - 2][col]) {
                        moves.push({ row: row - 2, col });
                    }
                }
                // Captures
                if (row > 0 && col > 0 && this.board[row - 1][col - 1] && this.isBlackPiece(this.board[row - 1][col - 1])) {
                    moves.push({ row: row - 1, col: col - 1 });
                }
                if (row > 0 && col < 7 && this.board[row - 1][col + 1] && this.isBlackPiece(this.board[row - 1][col + 1])) {
                    moves.push({ row: row - 1, col: col + 1 });
                }
                // En passant
                if (this.enPassantTarget && this.enPassantTarget.row === row - 1 && Math.abs(this.enPassantTarget.col - col) === 1) {
                    moves.push({ row: row - 1, col: this.enPassantTarget.col });
                }
                break;

            case '♟': // Black pawn
                if (row < 7 && !this.board[row + 1][col]) {
                    moves.push({ row: row + 1, col });
                    if (row === 1 && !this.board[row + 2][col]) {
                        moves.push({ row: row + 2, col });
                    }
                }
                // Captures
                if (row < 7 && col > 0 && this.board[row + 1][col - 1] && this.isWhitePiece(this.board[row + 1][col - 1])) {
                    moves.push({ row: row + 1, col: col - 1 });
                }
                if (row < 7 && col < 7 && this.board[row + 1][col + 1] && this.isWhitePiece(this.board[row + 1][col + 1])) {
                    moves.push({ row: row + 1, col: col + 1 });
                }
                // En passant
                if (this.enPassantTarget && this.enPassantTarget.row === row + 1 && Math.abs(this.enPassantTarget.col - col) === 1) {
                    moves.push({ row: row + 1, col: this.enPassantTarget.col });
                }
                break;

            case '♖': case '♜': // Rook
                this.addLineMoves(moves, row, col, 0, 1);
                this.addLineMoves(moves, row, col, 0, -1);
                this.addLineMoves(moves, row, col, 1, 0);
                this.addLineMoves(moves, row, col, -1, 0);
                break;

            case '♗': case '♝': // Bishop
                this.addLineMoves(moves, row, col, 1, 1);
                this.addLineMoves(moves, row, col, 1, -1);
                this.addLineMoves(moves, row, col, -1, 1);
                this.addLineMoves(moves, row, col, -1, -1);
                break;

            case '♕': case '♛': // Queen
                this.addLineMoves(moves, row, col, 0, 1);
                this.addLineMoves(moves, row, col, 0, -1);
                this.addLineMoves(moves, row, col, 1, 0);
                this.addLineMoves(moves, row, col, -1, 0);
                this.addLineMoves(moves, row, col, 1, 1);
                this.addLineMoves(moves, row, col, 1, -1);
                this.addLineMoves(moves, row, col, -1, 1);
                this.addLineMoves(moves, row, col, -1, -1);
                break;

            case '♘': case '♞': // Knight
                const knightMoves = [
                    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                    [1, -2], [1, 2], [2, -1], [2, 1]
                ];
                knightMoves.forEach(([dr, dc]) => {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    if (this.isInBounds(newRow, newCol)) {
                        moves.push({ row: newRow, col: newCol });
                    }
                });
                break;

            case '♔': case '♚': // King
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const newRow = row + dr;
                        const newCol = col + dc;
                        if (this.isInBounds(newRow, newCol)) {
                            moves.push({ row: newRow, col: newCol });
                        }
                    }
                }
                // Castling
                if (!this.isInCheck(this.currentTurn)) {
                    const color = this.currentTurn;
                    if (this.castlingRights[color].kingside) {
                        if (!this.board[row][col + 1] && !this.board[row][col + 2]) {
                            if (!this.wouldBeInCheck(row, col, row, col + 1, color) &&
                                !this.wouldBeInCheck(row, col, row, col + 2, color)) {
                                moves.push({ row, col: col + 2, special: 'castling_kingside' });
                            }
                        }
                    }
                    if (this.castlingRights[color].queenside) {
                        if (!this.board[row][col - 1] && !this.board[row][col - 2] && !this.board[row][col - 3]) {
                            if (!this.wouldBeInCheck(row, col, row, col - 1, color) &&
                                !this.wouldBeInCheck(row, col, row, col - 2, color)) {
                                moves.push({ row, col: col - 2, special: 'castling_queenside' });
                            }
                        }
                    }
                }
                break;
        }

        return moves;
    }

    addLineMoves(moves, row, col, dr, dc) {
        let newRow = row + dr;
        let newCol = col + dc;
        
        while (this.isInBounds(newRow, newCol)) {
            moves.push({ row: newRow, col: newCol });
            if (this.board[newRow][newCol]) break;
            newRow += dr;
            newCol += dc;
        }
    }

    isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    isWhitePiece(piece) {
        return '♔♕♖♗♘♙'.includes(piece);
    }

    isBlackPiece(piece) {
        return '♚♛♜♝♞♟'.includes(piece);
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const targetPiece = this.board[toRow][toCol];
        
        if (!piece) return false;
        if (targetPiece && this.isPieceOwnedByCurrentPlayer(toRow, toCol)) return false;
        
        const isWhite = this.isWhitePiece(piece);
        const color = isWhite ? 'white' : 'black';
        
        return !this.wouldBeInCheck(fromRow, fromCol, toRow, toCol, color);
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
        // Make temporary move
        const originalPiece = this.board[toRow][toCol];
        const movingPiece = this.board[fromRow][fromCol];
        this.board[toRow][toCol] = movingPiece;
        this.board[fromRow][fromCol] = null;
        
        const inCheck = this.isInCheck(color);
        
        // Undo move
        this.board[fromRow][fromCol] = movingPiece;
        this.board[toRow][toCol] = originalPiece;
        
        return inCheck;
    }

    isInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && this.isPieceOwnedByColor(piece, opponentColor)) {
                    const moves = this.getPossibleMoves(row, col, piece);
                    if (moves.some(move => move.row === kingPos.row && move.col === kingPos.col)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    isPieceOwnedByColor(piece, color) {
        const isWhite = this.isWhitePiece(piece);
        return (color === 'white' && isWhite) || (color === 'black' && !isWhite);
    }

    findKing(color) {
        const kingPiece = color === 'white' ? '♔' : '♚';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.board[row][col] === kingPiece) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    attemptMove(fromRow, fromCol, toRow, toCol) {
        const validMoves = this.getValidMoves(fromRow, fromCol);
        const move = validMoves.find(m => m.row === toRow && m.col === toCol);
        
        if (move) {
            this.makeMove(fromRow, fromCol, toRow, toCol, move.special);
        }
        
        this.clearSelection();
    }

    makeMove(fromRow, fromCol, toRow, toCol, special) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        // Record move
        const moveNotation = this.getMoveNotation(fromRow, fromCol, toRow, toCol, piece, capturedPiece, special);
        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece,
            captured: capturedPiece,
            special,
            notation: moveNotation
        });
        
        // Handle captures
        if (capturedPiece) {
            const capturingColor = this.currentTurn;
            this.capturedPieces[capturingColor].push(capturedPiece);
        }
        
        // Handle en passant
        if ((piece === '♙' || piece === '♟') && Math.abs(toCol - fromCol) === 1 && !capturedPiece) {
            const capturedRow = piece === '♙' ? toRow + 1 : toRow - 1;
            const enPassantPiece = this.board[capturedRow][toCol];
            this.capturedPieces[this.currentTurn].push(enPassantPiece);
            this.board[capturedRow][toCol] = null;
        }
        
        // Update en passant target
        this.enPassantTarget = null;
        if ((piece === '♙' && fromRow === 6 && toRow === 4) || 
            (piece === '♟' && fromRow === 1 && toRow === 3)) {
            this.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
        }
        
        // Handle castling
        if (special === 'castling_kingside') {
            this.board[fromRow][fromCol + 1] = this.board[fromRow][7];
            this.board[fromRow][7] = null;
        } else if (special === 'castling_queenside') {
            this.board[fromRow][fromCol - 1] = this.board[fromRow][0];
            this.board[fromRow][0] = null;
        }
        
        // Update castling rights
        this.updateCastlingRights(piece, fromRow, fromCol);
        
        // Make the move
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // Handle pawn promotion
        if ((piece === '♙' && toRow === 0) || (piece === '♟' && toRow === 7)) {
            this.promotePawn(toRow, toCol);
        }
        
        // Switch turns
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
        
        // Update UI
        this.renderBoard();
        this.updateMoveHistory();
        this.updateCapturedPieces();
        
        // Check game state
        this.checkGameState();
    }

    updateCastlingRights(piece, fromRow, fromCol) {
        const color = this.isWhitePiece(piece) ? 'white' : 'black';
        
        if (piece === '♔' || piece === '♚') {
            this.castlingRights[color].kingside = false;
            this.castlingRights[color].queenside = false;
        }
        
        if (piece === '♖' || piece === '♜') {
            if (fromCol === 0) this.castlingRights[color].queenside = false;
            if (fromCol === 7) this.castlingRights[color].kingside = false;
        }
    }

    promotePawn(row, col) {
        const color = this.isWhitePiece(this.board[row][col]) ? 'white' : 'black';
        const queen = color === 'white' ? '♕' : '♛';
        this.board[row][col] = queen;
    }

    getMoveNotation(fromRow, fromCol, toRow, toCol, piece, captured, special) {
        const files = 'abcdefgh';
        const ranks = '87654321';
        const pieceSymbols = { '♔': 'K', '♕': 'Q', '♖': 'R', '♗': 'B', '♘': 'N', '♙': '', '♚': 'K', '♛': 'Q', '♜': 'R', '♝': 'B', '♞': 'N', '♟': '' };
        
        let notation = '';
        
        if (special === 'castling_kingside') {
            notation = 'O-O';
        } else if (special === 'castling_queenside') {
            notation = 'O-O-O';
        } else {
            notation += pieceSymbols[piece] || '';
            notation += files[fromCol] + ranks[fromRow];
            notation += captured ? 'x' : '-';
            notation += files[toCol] + ranks[toRow];
        }
        
        return notation;
    }

    checkGameState() {
        const color = this.currentTurn;
        const inCheck = this.isInCheck(color);
        const hasValidMoves = this.hasAnyValidMoves(color);
        
        if (!hasValidMoves) {
            if (inCheck) {
                this.updateGameStatus(`Checkmate! ${color === 'white' ? 'Black' : 'White'} wins!`);
            } else {
                this.updateGameStatus('Stalemate! Draw!');
            }
        } else if (inCheck) {
            this.updateGameStatus('Check!');
            this.highlightKingInCheck(color);
        } else {
            this.updateGameStatus('Game in progress');
        }
    }

    highlightKingInCheck(color) {
        const kingPos = this.findKing(color);
        if (kingPos) {
            const square = document.querySelector(`[data-row="${kingPos.row}"][data-col="${kingPos.col}"]`);
            square.classList.add('check-warning');
        }
    }

    hasAnyValidMoves(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && this.isPieceOwnedByColor(piece, color)) {
                    const validMoves = this.getValidMoves(row, col);
                    if (validMoves.length > 0) return true;
                }
            }
        }
        return false;
    }

    updateTurnIndicator() {
        const turnElement = document.getElementById('current-turn');
        turnElement.textContent = `${this.currentTurn === 'white' ? 'White' : 'Black'}'s Turn`;
    }

    updateGameStatus(status) {
        const statusElement = document.getElementById('game-status');
        if (status) {
            statusElement.textContent = status;
        }
    }

    updateMoveHistory() {
        const moveList = document.getElementById('move-list');
        moveList.innerHTML = '';
        
        this.moveHistory.forEach((move, index) => {
            const moveItem = document.createElement('div');
            moveItem.className = 'move-item';
            const moveNumber = Math.floor(index / 2) + 1;
            const isWhiteMove = index % 2 === 0;
            
            if (isWhiteMove) {
                moveItem.textContent = `${moveNumber}. ${move.notation}`;
            } else {
                const previousItem = moveList.lastElementChild;
                if (previousItem) {
                    previousItem.textContent += ` ${move.notation}`;
                }
                return;
            }
            
            moveList.appendChild(moveItem);
        });
        
        moveList.scrollTop = moveList.scrollHeight;
    }

    updateCapturedPieces() {
        const whiteCaptured = document.getElementById('white-captured');
        const blackCaptured = document.getElementById('black-captured');
        
        whiteCaptured.innerHTML = this.capturedPieces.white.join(' ');
        blackCaptured.innerHTML = this.capturedPieces.black.join(' ');
    }

    undoLastMove() {
        if (this.moveHistory.length === 0) return;
        
        const lastMove = this.moveHistory.pop();
        
        // Undo the move
        this.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
        this.board[lastMove.to.row][lastMove.to.col] = lastMove.captured;
        
        // Restore captured pieces
        if (lastMove.captured) {
            const capturingColor = this.currentTurn === 'white' ? 'black' : 'white';
            this.capturedPieces[capturingColor].pop();
        }
        
        // Switch turns back
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
        
        // Update UI
        this.renderBoard();
        this.updateMoveHistory();
        this.updateCapturedPieces();
    }

    resetGame() {
        this.board = [];
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        
        this.initializeBoard();
        this.renderBoard();
        this.updateMoveHistory();
        this.updateCapturedPieces();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new ChessGame();
});
