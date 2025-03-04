import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { ref, get } from 'firebase/database';
import { database } from '../../config/firebase';
import { useNavigation } from '@react-navigation/native';

const ChairSelection = () => {
  const [chairs, setChairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nfcSupported, setNfcSupported] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    // Fetch chairs from Firebase
    const fetchChairs = async () => {
      try {
        const chairsRef = ref(database, 'chairs');
        const snapshot = await get(chairsRef);
        
        if (snapshot.exists()) {
          const chairsData = snapshot.val();
          const chairsList = Object.keys(chairsData).map(id => ({
            id,
            ...chairsData[id]
          }));
          setChairs(chairsList);
        } else {
          setChairs([]);
        }
      } catch (error) {
        setError('Failed to load chairs: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    // Check NFC availability
    const checkNfcSupport = async () => {
      const supported = await NfcManager.isSupported();
      setNfcSupported(supported);

      if (supported) {
        await NfcManager.start();
      }
    };

    fetchChairs();
    checkNfcSupport();

    // Cleanup
    return () => {
      NfcManager.cancel();
    };
  }, []);

  const readNfcTag = async () => {
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      
      if (tag && tag.id) {
        const chairId = tag.id.toString();
        
        // Check if chair exists in database
        const chairRef = ref(database, `chairs/${chairId}`);
        const snapshot = await get(chairRef);
        
        if (snapshot.exists()) {
          // Navigate to specific chair details
          navigation.navigate('ChairDetails', { chairId });
        } else {
          // Prompt to add new chair
          Alert.alert(
            'Unknown Chair', 
            'This chair is not registered. Would you like to add it?',
            [
              {
                text: 'Add Chair',
                onPress: () => navigation.navigate('AddChair', { chairId })
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }
      }
    } catch (ex) {
      console.warn('NFC read error', ex);
      Alert.alert('NFC Error', 'Could not read NFC tag');
    } finally {
      NfcManager.cancelTechnology();
    }
  };

  const handleChairSelect = (chairId) => {
    navigation.navigate('ChairDetails', { chairId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo and Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>SC</Text>
          </View>
          
          <Text style={styles.titleText}>Smart Chair</Text>
          <Text style={styles.subtitleText}>Select a chair to monitor</Text>
        </View>
        
        {/* NFC Scan Button */}
        {nfcSupported && (
          <TouchableOpacity 
            style={styles.nfcButton} 
            onPress={readNfcTag}
          >
            <Text style={styles.nfcButtonText}>Scan NFC Tag</Text>
          </TouchableOpacity>
        )}
        
        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.spinner}></View>
            <Text style={styles.loadingText}>Loading chairs...</Text>
          </View>
        ) : (
          <>
            {/* No Chairs State */}
            {chairs.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateTitle}>No chairs found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  You haven't added any chairs to monitor yet.
                </Text>
              </View>
            ) : (
              /* Chair Grid */
              <View style={styles.chairGrid}>
                {chairs.map((chair) => (
                  <TouchableOpacity 
                    key={chair.id}
                    style={styles.chairCard}
                    onPress={() => handleChairSelect(chair.id)}
                  >
                    <View style={styles.chairCardHeader}>
                      <View style={styles.chairIconCircle}>
                        <Text style={styles.chairIconText}>CH</Text>
                      </View>
                      <Text style={styles.chairTitleText}>Chair #{chair.id}</Text>
                    </View>
                    <Text style={styles.chairLocationText}>
                      {chair.location || "No location specified"}
                    </Text>
                    <View style={styles.chairCardFooter}>
                      <Text style={styles.viewDetailsText}>View details</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {/* Add New Chair Button */}
            <TouchableOpacity 
              style={styles.addChairButton}
              onPress={() => navigation.navigate('AddChair')}
            >
              <Text style={styles.addChairButtonText}>Add New Chair</Text>
            </TouchableOpacity>
          </>
        )}
        
        {/* Navigation Option */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Return to previous page</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF6FF', // Gradient background approximation
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitleText: {
    color: '#6B7280',
    marginTop: 5,
  },
  nfcButton: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  nfcButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  spinner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#2563EB',
    borderTopColor: 'transparent',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
  },
  emptyStateContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  emptyStateSubtitle: {
    color: '#6B7280',
    marginTop: 5,
  },
  chairGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  chairCard: {
    width: '48%',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  chairCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chairIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chairIconText: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  chairTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chairLocationText: {
    color: '#6B7280',
    marginBottom: 10,
  },
  chairCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  viewDetailsText: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  addChairButton: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  addChairButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#2563EB',
  }
});

export default ChairSelection;
