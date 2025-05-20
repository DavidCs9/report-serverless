import { useState } from "react";
import {
  ChakraProvider,
  Box,
  VStack,
  Heading,
  Button,
  Text,
  Container,
  Spinner,
} from "@chakra-ui/react";
import { useToast } from "@chakra-ui/toast";
import axios from "axios";

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [generateReportTime, setGenerateReportTime] = useState<number | null>(
    null
  );
  const toast = useToast();

  const generateReport = async () => {
    setIsLoading(true);
    setReportUrl(null);
    const startTime = new Date();

    try {
      const response = await axios.post(
        "http://localhost:3000/api/initiate-silo-report"
      );
      setReportUrl(response.data.s3Url);
      toast({
        title: "Report Generated",
        description: "Your report has been generated successfully!",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Error generating report:", err);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      setGenerateReportTime(duration);
    }
  };

  return (
    <ChakraProvider>
      <Container maxW="container.md" h="100vh" py={10}>
        <VStack spacing={8}>
          <Heading>Silo Report Generator</Heading>

          <Box
            p={8}
            borderWidth={1}
            borderRadius="lg"
            boxShadow="lg"
            w="100%"
            textAlign="center"
          >
            <VStack spacing={4}>
              <Text>Click the button below to generate a new silo report.</Text>

              <Button
                colorScheme="blue"
                onClick={generateReport}
                isLoading={isLoading}
                loadingText="Generating..."
                size="lg"
              >
                Generate Report
              </Button>

              {isLoading && (
                <Box>
                  <Spinner size="xl" />
                  <Text mt={4}>Generating your report...</Text>
                </Box>
              )}

              {reportUrl && (
                <Box mt={4}>
                  <Text fontWeight="bold" mb={2}>
                    Report Ready! ({generateReportTime}ms)
                  </Text>
                  <Button
                    as="a"
                    href={reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    colorScheme="green"
                    size="md"
                  >
                    Download Report
                  </Button>
                </Box>
              )}
            </VStack>
          </Box>
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App;
