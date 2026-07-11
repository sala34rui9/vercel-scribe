export const generateCloudflareImage = async (prompt: string, style?: string, ratio?: string): Promise<string> => {
  const url = localStorage.getItem('user_cloudflare_api_url');
  const token = localStorage.getItem('user_cloudflare_api_token');
  
  if (!url || !token) {
    throw new Error('Cloudflare Image API is not configured.');
  }

  try {
    let finalPrompt = prompt;
    if (style) finalPrompt += `, ${style} style`;
    if (ratio) finalPrompt += `, ${ratio} aspect ratio`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: finalPrompt })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cloudflare API Error (${response.status}): ${text}`);
    }

    const blob = await response.blob();
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Failed to generate image via Cloudflare:', e);
    throw e;
  }
};
