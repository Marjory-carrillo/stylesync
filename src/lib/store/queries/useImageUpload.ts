import { useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

/**
 * Hook para subir imágenes al Storage de Supabase.
 * Reemplaza uploadServiceImage y uploadStylistPhoto del store.tsx monolítico.
 */
export const useImageUpload = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();

    const uploadImage = useCallback(async (
        file: File,
        bucket: string,
        folder: string,
        customTenantId?: number
    ): Promise<string | null> => {
        const activeTenantId = customTenantId || tenantId;
        if (!activeTenantId) {
            showToast('Sin tenant para subir imagen', 'error');
            return null;
        }

        const ext = file.name.split('.').pop();
        const fileName = `${folder}/${activeTenantId}_${Date.now()}.${ext}`;

        const { error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, { upsert: true });

        if (error) {
            showToast(`Error al subir imagen: ${error.message}`, 'error');
            return null;
        }

        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);

        return data.publicUrl;
    }, [tenantId, showToast]);

    const uploadServiceImage = useCallback((file: File) =>
        uploadImage(file, 'services', 'images'),
        [uploadImage]);

    const uploadStylistPhoto = useCallback((file: File) =>
        uploadImage(file, 'stylists', 'photos'),
        [uploadImage]);

    const uploadLogo = useCallback((file: File) =>
        uploadImage(file, 'logos', 'tenants'),
        [uploadImage]);

    const uploadNailDesign = useCallback((file: File, customTenantId?: number) =>
        uploadImage(file, 'services', 'nail_designs', customTenantId),
        [uploadImage]);

    const uploadCatalogImage = useCallback((file: File) =>
        uploadImage(file, 'services', 'catalog'),
        [uploadImage]);

    return { uploadServiceImage, uploadStylistPhoto, uploadLogo, uploadNailDesign, uploadCatalogImage };
};
