const ApiService = {
    async get(url) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('[ApiService] GET error:', error);
            throw error;
        }
    },

    async post(url, data) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('[ApiService] POST error:', error);
            throw error;
        }
    },

    async upload(url, formData) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('[ApiService] UPLOAD error:', error);
            throw error;
        }
    },

    async handleResponse(response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || `HTTP Error ${response.status}`);
        }
        return await response.json();
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}