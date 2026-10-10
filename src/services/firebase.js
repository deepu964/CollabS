// Firestore has been removed in favor of direct Cloudinary media management.
export const isFirebaseConfigured = () => false;
export const subscribeToReferences = () => () => {};
export const saveReferenceToFirestore = async () => {};
export const deleteReferenceFromFirestore = async () => {};
