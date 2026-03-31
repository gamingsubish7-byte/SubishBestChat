export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  imageData?: {
    data: string; // base64
    mimeType: string;
  };
  apiKeySource?: 'lumina' | 'custom';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
