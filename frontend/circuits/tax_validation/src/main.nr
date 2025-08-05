// Circuit to verify if the total amount paid in taxes equals the sum of individual tax components
// Based on example: ii(9000) + ipi(3000) + pis(800) + cofins(3600) + icms(6500) = 22900
fn main(
    // Individual tax components (private)
    ii: u64,
    ipi: u64, 
    pis: u64,
    cofins: u64,
    icms: u64,
    // Total amount paid (public for verification)
    total_amount_paid: pub u64
) {
    // Calculate the sum of all tax components
    let calculated_total: u64 = ii + ipi + pis + cofins + icms;

    // Verify that the declared total matches the sum of components
    assert(calculated_total == total_amount_paid);
}

#[test]
fn test_main_example_data() {
    // Test with example data from the JSON
    let ii = 9000;
    let ipi = 3000;
    let pis = 800;
    let cofins = 3600;
    let icms = 6500;
    let total_amount_paid = 22900; // Sum should equal 22900

    main(ii, ipi, pis, cofins, icms, total_amount_paid);
}

#[test(should_fail)]
fn test_main_incorrect_total() {
    // Test with incorrect total (should fail)
    let ii = 9000;
    let ipi = 3000;
    let pis = 800;
    let cofins = 3600;
    let icms = 6500;
    let total_amount_paid = 20000; // Incorrect total - should be 22900

    main(ii, ipi, pis, cofins, icms, total_amount_paid);
}

#[test]
fn test_main_different_values() {
    // Test with different tax values
    let ii = 5000;
    let ipi = 2000;
    let pis = 500;
    let cofins = 2000;
    let icms = 4000;
    let total_amount_paid = 13500; // Sum = 13500

    main(ii, ipi, pis, cofins, icms, total_amount_paid);
}